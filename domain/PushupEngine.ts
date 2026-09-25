import { KinematicMath, Point3D } from "./KineticMath";

export type PushupState = "IDLE" | "UP" | "TRANSITION_DOWN" | "DOWN" | "TRANSITION_UP";

export interface PushupEvent {
  type: "REP_COUNTED" | "FORM_WARNING";
  message?: string;
  accuracy?: number;
}

export class PushupEngine {
  private currentState: PushupState = "IDLE";
  private frameCountInState = 0;
  private readonly DEBOUNCE_FRAMES = 3;

  private minElbowAngleInCurrentRep = 180;
  private smoothedAngle: number | null = null;
  private readonly SMOOTHING_ALPHA = 0.4; // lower = smoother, higher = more responsive
  private lastIsFrontal: boolean = true;
  private frontalWarningFrames = 0;

  public processFrame(landmarks: Point3D[]): PushupEvent | null {
    // Try LEFT side (11,13,15) first, fall back to RIGHT side (12,14,16)
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];

    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];

    const leftVisible =
      KinematicMath.isVisible(leftShoulder) &&
      KinematicMath.isVisible(leftElbow) &&
      KinematicMath.isVisible(leftWrist);

    const rightVisible =
      KinematicMath.isVisible(rightShoulder) &&
      KinematicMath.isVisible(rightElbow) &&
      KinematicMath.isVisible(rightWrist);

    let shoulder: Point3D, elbow: Point3D, wrist: Point3D;
    let hip: Point3D, knee: Point3D, ankle: Point3D;

    if (leftVisible && rightVisible) {
      // Use Z-coordinate (depth) to strictly pick the side closest to the camera
      // Smaller (more negative) Z means it is closer to the lens
      const leftZ = leftShoulder.z + leftElbow.z + leftWrist.z;
      const rightZ = rightShoulder.z + rightElbow.z + rightWrist.z;
      
      if (leftZ < rightZ) {
        shoulder = leftShoulder; elbow = leftElbow; wrist = leftWrist;
        hip = leftHip; knee = leftKnee; ankle = leftAnkle;
      } else {
        shoulder = rightShoulder; elbow = rightElbow; wrist = rightWrist;
        hip = rightHip; knee = rightKnee; ankle = rightAnkle;
      }
    } else if (leftVisible) {
      shoulder = leftShoulder; elbow = leftElbow; wrist = leftWrist;
      hip = leftHip; knee = leftKnee; ankle = leftAnkle;
    } else if (rightVisible) {
      shoulder = rightShoulder; elbow = rightElbow; wrist = rightWrist;
      hip = rightHip; knee = rightKnee; ankle = rightAnkle;
    } else {
      return null; // neither side visible enough
    }

    // Reject knee pushups
    if (KinematicMath.isVisible(hip) && KinematicMath.isVisible(knee) && KinematicMath.isVisible(ankle)) {
      const kneeAngle = KinematicMath.calculate2DAngleLandscape(knee, hip, ankle);
      if (kneeAngle < 140) {
        return null; // Legs must be straight
      }
    }

    let rawAngle: number;

    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    let isFrontal = leftVisible && rightVisible && (shoulderWidth > 0.15);

    // Hysteresis to prevent isFrontal from flickering when sitting near the threshold
    if (this.lastIsFrontal && shoulderWidth > 0.12) {
      isFrontal = true;
    } else if (!this.lastIsFrontal && shoulderWidth < 0.18) {
      isFrontal = false;
    }
    this.lastIsFrontal = isFrontal;

    if (isFrontal) {
      // Reject frontal pushups because we cannot track knee drops or proper body alignment reliably.
      // The user must face sideways (side profile) for pushups.
      this.frontalWarningFrames++;
      if (this.frontalWarningFrames === 30) {
        return {
          type: "FORM_WARNING",
          message: "For accurate tracking, please position yourself sideways to the camera.",
        };
      }
      return null;
    } else {
      this.frontalWarningFrames = 0;
      // If they are sitting or standing, their body is vertical, and arm movements shouldn't count as pushups.
      // We check hip first, then knee, then ankle to determine body orientation.
      const lowerBodyRef = KinematicMath.isVisible(hip) ? hip : (KinematicMath.isVisible(knee) ? knee : (KinematicMath.isVisible(ankle) ? ankle : null));
      if (lowerBodyRef) {
        const bodyDx = Math.abs(shoulder.x - lowerBodyRef.x);
        const bodyDy = Math.abs(shoulder.y - lowerBodyRef.y);
        
        // Reject if torso/body is strictly vertical (sitting/standing)
        if (bodyDy > bodyDx * 1.2) {
          return null;
        }
      }

      rawAngle = KinematicMath.calculate2DAngleLandscape(elbow, shoulder, wrist);
    }

    // We rely on the PoseSmoother in poseStore to smooth the raw coordinates.
    // Double smoothing the angles here causes massive latency and ruins accuracy.
    const elbowAngle = rawAngle;

    this.minElbowAngleInCurrentRep = Math.min(this.minElbowAngleInCurrentRep, elbowAngle);

    switch (this.currentState) {
      case "IDLE":
      case "UP":
        if (elbowAngle > 150) {
          this.changeState("UP");
        } else if (elbowAngle < 150) {
          this.changeState("TRANSITION_DOWN");
        }
        break;

      case "TRANSITION_DOWN":
        if (elbowAngle <= 90) {
          if (this.frameCountInState >= this.DEBOUNCE_FRAMES) {
            this.changeState("DOWN");
          } else {
            this.frameCountInState++;
          }
        } else if (elbowAngle > 150) {
          if (this.minElbowAngleInCurrentRep < 135) {
            // INSTANT COUNT FOR FAST REPS! No debounce needed to finish a rep.
            this.changeState("UP");
            return this.evaluateRep();
          } else {
            this.changeState("UP");
            this.minElbowAngleInCurrentRep = 180;
          }
        } else {
          this.frameCountInState++;
        }
        break;

      case "DOWN":
        if (elbowAngle > 100) {
          this.changeState("TRANSITION_UP");
        }
        break;

      case "TRANSITION_UP":
        if (elbowAngle >= 150) {
          // INSTANT COUNT! No debounce needed. If they hit the UP threshold, the rep is done.
          this.changeState("UP");
          return this.evaluateRep();
        } else if (elbowAngle < 90) {
          this.changeState("DOWN");
        } else {
          this.frameCountInState++;
        }
        break;
    }

    return null;
  }

  private changeState(newState: PushupState) {
    if (this.currentState !== newState) {
      this.currentState = newState;
      this.frameCountInState = 0;
    }
  }

  private evaluateRep(): PushupEvent {
    // A brutal 3.0 multiplier with a 65-degree target ensures maximum strictness!
    // The user must bend significantly past 90 degrees to score high accuracy.
    let calculatedAccuracy = 100 - Math.max(0, (this.minElbowAngleInCurrentRep - 75) * 2.0);
    let accuracy = Math.max(0, Math.min(100, calculatedAccuracy));

    const lowestAngle = this.minElbowAngleInCurrentRep;
    this.minElbowAngleInCurrentRep = 180;

    if (accuracy >= 85) {
      return {
        type: "REP_COUNTED",
        accuracy: Math.floor(accuracy),
        message: "Rep counted.",
      };
    } else {
      let coachMessage = "Go a bit lower next time.";
      
      if (lowestAngle > 120) {
        coachMessage = "Come on, drop that chest! You barely bent your arms. Get those elbows to a 90-degree angle!";
      } else if (lowestAngle > 95) {
        coachMessage = "Almost there, but bend those elbows a bit more! Let's hit that perfect 90-degree angle!";
      } else {
        coachMessage = "Push through the full range of motion! Lower your chest just a little bit more.";
      }

      return {
        type: "FORM_WARNING",
        accuracy: Math.floor(accuracy),
        message: coachMessage,
      };
    }
  }
}