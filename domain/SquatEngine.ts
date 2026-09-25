import { KinematicMath, Point3D } from "./KineticMath";

export type SquatState = "IDLE" | "UP" | "TRANSITION_DOWN" | "DOWN" | "TRANSITION_UP";

export interface SquatEvent {
  type: "REP_COUNTED" | "FORM_WARNING";
  message?: string;
  accuracy?: number;
}

export class SquatEngine {
  private currentState: SquatState = "IDLE";
  private frameCountInState = 0;
  private framesLost = 0;
  private readonly DEBOUNCE_FRAMES = 2; // Reduced slightly to catch faster, explosive movements without getting stuck

  private minKneeAngleInCurrentRep = 180;
  private smoothedAngle: number | null = null;
  // Massively increased alpha to eliminate the "tracking lag". It now catches the true depth of fast bouncing reps!
  private readonly SMOOTHING_ALPHA = 0.8;
  private isFrontal = true;

  public processFrame(landmarks: Point3D[]): SquatEvent | null {
    // LEFT: hip 23, knee 25, ankle 27 | RIGHT: hip 24, knee 26, ankle 28
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];

    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];

    const leftVisible =
      KinematicMath.isVisible(leftHip) &&
      KinematicMath.isVisible(leftKnee) &&
      KinematicMath.isVisible(leftAnkle);

    const rightVisible =
      KinematicMath.isVisible(rightHip) &&
      KinematicMath.isVisible(rightKnee) &&
      KinematicMath.isVisible(rightAnkle);

    let hip: Point3D, knee: Point3D, ankle: Point3D;

    if (leftVisible && rightVisible) {
      const leftConf = (leftHip.visibility ?? 0) + (leftKnee.visibility ?? 0) + (leftAnkle.visibility ?? 0);
      const rightConf = (rightHip.visibility ?? 0) + (rightKnee.visibility ?? 0) + (rightAnkle.visibility ?? 0);
      if (leftConf >= rightConf) {
        hip = leftHip; knee = leftKnee; ankle = leftAnkle;
      } else {
        hip = rightHip; knee = rightKnee; ankle = rightAnkle;
      }
    } else if (leftVisible) {
      hip = leftHip; knee = leftKnee; ankle = leftAnkle;
    } else if (rightVisible) {
      hip = rightHip; knee = rightKnee; ankle = rightAnkle;
    } else {
      this.framesLost++;
      if (this.framesLost > 15) {
        this.changeState("IDLE");
      }
      return null;
    }

    this.framesLost = 0;

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    if (KinematicMath.isVisible(leftShoulder) && KinematicMath.isVisible(rightShoulder)) {
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const shoulderDepth = Math.abs((leftShoulder.z || 0) - (rightShoulder.z || 0));
      this.isFrontal = (shoulderWidth > shoulderDepth * 1.2) && (shoulderWidth > 0.12);
    }

    let rawAngle: number;

    if (this.isFrontal) {
      // 3D angles are unreliable for frontal squats due to Z-axis compression.
      // Instead, we use a robust Y-axis distance ratio to estimate depth.
      const hipKneeY = knee.y - hip.y;
      const kneeAnkleY = ankle.y - knee.y;

      // Prevent division by zero
      const normalizedKneeAnkle = Math.max(0.01, kneeAnkleY);

      // Ratio is ~1.0 when standing, 0.0 at parallel squat (hip at knee level)
      const ratio = hipKneeY / normalizedKneeAnkle;

      // To balance 3D accuracy to be STRICT on shallow (Easy) squats:
      // ratio 1.0 (standing) -> 180 deg
      // ratio 0.15 (slightly shallow) -> ~99 deg (Warning)
      // ratio 0.0 (parallel) -> 85 deg (Perfect Rep)
      // ratio < 0.0 (hips below knees) -> Steeper drop to trigger deep warning
      if (ratio >= 0.0) {
        // Map ratio [0.0, 1.0] to angle [85, 180]
        rawAngle = 85 + (Math.min(1.0, ratio) * 95);
      } else if (ratio >= -0.25) {
        // Safe deep squat: gently map ratio down to 65 degrees
        rawAngle = 85 + (ratio * 80);
      } else {
        // Collapsed (sitting on calves): aggressively drop the angle to trigger the deep penalty
        rawAngle = 65 + ((ratio + 0.25) * 300);
      }

      // Allow angle to drop to 10 so the deepPenalty calculation can successfully trigger
      rawAngle = Math.max(10, Math.min(180, rawAngle));
    } else {
      let physicalAngle = KinematicMath.calculate2DAngle(knee, hip, ankle);

      if (physicalAngle < 55) {
        // 2D Calf Touch Warning: If physical angle drops below 55 (calves touching hamstrings),
        // we forcefully drop the engine angle below 45 so `deepPenalty` catches it accurately.
        // A physical angle of 45 drops to 25, triggering a 30% penalty (Failing the rep).
        rawAngle = 45 - ((55 - physicalAngle) * 2.0);
      } else {
        // Unified strictness for ALL 2D sideways squats (both left and right).
        // With the tracking lag eliminated, +35 is the perfectly balanced sweet spot for a strict rep.
        rawAngle = physicalAngle + 35;
      }
    }

    this.smoothedAngle =
      this.smoothedAngle === null
        ? rawAngle
        : this.smoothedAngle + this.SMOOTHING_ALPHA * (rawAngle - this.smoothedAngle);

    const kneeAngle = this.smoothedAngle;

    this.minKneeAngleInCurrentRep = Math.min(this.minKneeAngleInCurrentRep, kneeAngle);

    switch (this.currentState) {
      case "IDLE":
        // Force the user to start from a mostly standing position before any tracking begins
        if (kneeAngle >= 150) { // Eased from 160
          this.changeState("UP");
          this.minKneeAngleInCurrentRep = 180;
        }
        break;

      case "UP":
        if (kneeAngle < 130) { // Eased from 150
          this.changeState("TRANSITION_DOWN");
        }
        break;

      case "TRANSITION_DOWN":
        if (kneeAngle <= 110) {
          if (this.frameCountInState >= this.DEBOUNCE_FRAMES) {
            this.changeState("DOWN");
          } else {
            this.frameCountInState++;
          }
        } else if (kneeAngle > 135) { // Eased from 150 to catch back-to-back fast reps
          if (this.minKneeAngleInCurrentRep < 125) { // Adjusted from 135 to match eased bounds
            // INSTANT COUNT FOR FAST REPS! No debounce needed to finish a rep.
            this.changeState("UP");
            return this.evaluateRep();
          } else {
            this.changeState("UP");
            this.minKneeAngleInCurrentRep = 180;
          }
        } else {
          this.frameCountInState++;
        }
        break;

      case "DOWN":
        if (kneeAngle > 110) {
          this.changeState("TRANSITION_UP");
        }
        break;

      case "TRANSITION_UP":
        if (kneeAngle >= 135) { // Eased from 150 to ensure reps count even if user doesn't fully lock out knees
          // INSTANT COUNT! No debounce needed. If they hit the UP threshold, the rep is done.
          this.changeState("UP");
          return this.evaluateRep();
        } else if (kneeAngle < 110) {
          this.changeState("DOWN");
        } else {
          this.frameCountInState++;
        }
        break;
    }

    return null;
  }

  private changeState(newState: SquatState) {
    if (this.currentState !== newState) {
      this.currentState = newState;
      this.frameCountInState = 0;
    }
  }

  private evaluateRep(): SquatEvent | null {
    // Both frontal (mapped via Y-ratio) and side squats use a ~90-degree geometric target for parallel.
    // User requested balanced bounds: penalize very shallow squats but 90 degrees is considered perfect.

    // Penalize if the squat is too shallow (angle > 90)
    let shallowPenalty = Math.max(0, (this.minKneeAngleInCurrentRep - 90) * 2.5);

    // Deep squats are good! Only penalize if they literally collapse (angle < 45), 
    // which indicates complete loss of tension.
    let deepPenalty = Math.max(0, (45 - this.minKneeAngleInCurrentRep) * 1.5);

    let calculatedAccuracy = 100 - shallowPenalty - deepPenalty;
    let accuracy = Math.max(0, Math.min(100, calculatedAccuracy));

    const finalAngle = this.minKneeAngleInCurrentRep;
    this.minKneeAngleInCurrentRep = 180;

    // Never silently fail! If a rep was attempted but too shallow, 
    // emit a warning so the user isn't left hanging.
    if (accuracy < 30) {
      return {
        type: "FORM_WARNING",
        accuracy: Math.floor(accuracy),
        message: "Rep too shallow to count. Bend deeper!",
      };
    }

    if (accuracy >= 85) {
      return {
        type: "REP_COUNTED",
        accuracy: Math.floor(accuracy),
        message: "Rep counted.",
      };
    } else {
      let coachMessage = "Go lower, try to hit parallel.";

      if (finalAngle > 120) {
        coachMessage = "Please bend your knees deeper. That was a very shallow squat.";
      } else if (finalAngle > 100) {
        coachMessage = "For a full squat, please ensure your thighs reach parallel to the floor.";
      } else if (finalAngle > 90) {
        coachMessage = "Almost perfect. Drop just a bit lower to hit parallel.";
      } else {
        coachMessage = "Please avoid resting on your calves. Maintain tension at the bottom of the squat.";
      }

      return {
        type: "FORM_WARNING",
        accuracy: Math.floor(accuracy),
        message: coachMessage,
      };
    }
  }
}