import { Point3D } from "./KineticMath";

export type PlankState = "NOT_STARTED" | "VALID" | "WARNING";

export interface PlankEvent {
  type: "FORM_VALID" | "FORM_WARNING" | "DEBUG_UPDATE";
  message?: string;
  angles?: { alignment: number; shoulder: number; elbow: number };
}

export class PlankEngine {
  private currentState: PlankState = "NOT_STARTED";
  private validFrames = 0;
  private invalidFrames = 0;

  // Snappy debounce settings per user request
  private readonly DEBOUNCE_FRAMES_START = 10;
  private readonly DEBOUNCE_FRAMES_STOP = 3;

  // Smoothing to counteract noisy readings (especially 3D Z-axis)
  private readonly SMOOTHING_ALPHA = 0.4;
  private smoothedAngles: { alignment: number; shoulder: number; elbow: number; kneeStr: number; kneeSag: number } | null = null;

  // Dynamic Form Locking
  private lockedAngles: { alignment: number; shoulder: number; elbow: number } | null = null;
  private readonly BODY_TOLERANCE = 18; // Increased from 12 to allow balanced freedom
  private readonly ARM_TOLERANCE = 24;  // Increased from 18 to allow balanced freedom

  // Adjustable Thresholds
  private readonly KNEE_STRAIGHT_THRESHOLD = 140; // Increased from 115 to prevent cheating with bent knees

  public processFrame(landmarks: Point3D[]): PlankEvent | null {
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const leftFoot = landmarks[31];

    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    const rightFoot = landmarks[32];

    const head = landmarks[0];

    // Evaluate visibility of both sides
    const leftVis = (leftShoulder?.visibility || 0) + (leftElbow?.visibility || 0) + (leftHip?.visibility || 0) + (leftKnee?.visibility || 0);
    const rightVis = (rightShoulder?.visibility || 0) + (rightElbow?.visibility || 0) + (rightHip?.visibility || 0) + (rightKnee?.visibility || 0);

    // Select the most visible side for angle calculations
    const useLeft = leftVis >= rightVis;
    const shoulder = useLeft ? leftShoulder : rightShoulder;
    const elbow = useLeft ? leftElbow : rightElbow;
    const wrist = useLeft ? leftWrist : rightWrist;
    const hip = useLeft ? leftHip : rightHip;
    const knee = useLeft ? leftKnee : rightKnee;
    const ankle = useLeft ? leftAnkle : rightAnkle;
    const foot = useLeft ? leftFoot : rightFoot;

    // We rely purely on the geometric angle checks to validate the pose.
    // If the user is out of frame, the angles will naturally fail the constraints.

    // --- ROTATION-INVARIANT FRONTAL DETECTION ---
    // Measure 2D pixel distance regardless of portrait/landscape orientation
    const shoulderDx = leftShoulder.x - rightShoulder.x;
    const shoulderDy = leftShoulder.y - rightShoulder.y;
    const shoulderWidth2D = Math.sqrt(shoulderDx * shoulderDx + shoulderDy * shoulderDy);

    const torsoDx = shoulder.x - hip.x;
    const torsoDy = shoulder.y - hip.y;
    const torsoLength2D = Math.sqrt(torsoDx * torsoDx + torsoDy * torsoDy);

    // If shoulders are wide relative to torso length, user is facing camera
    const isFrontal = shoulderWidth2D > torsoLength2D * 0.4;

    // --- ANGLE CALCULATIONS ---
    // Plank is strictly locked to Landscape mode in the UI, so we bypass the buggy Portrait 3D calculations
    // and use a dedicated 2D Landscape angle calculator to prevent Aspect-Ratio distortion!
    let rawAlignment: number;
    let rawShoulder: number;
    let rawElbow: number;
    let rawKneeStr: number;

    rawAlignment = this.calculate2DAngleLandscape(hip, shoulder, knee);

    const oppositeShoulder = useLeft ? rightShoulder : leftShoulder;
    rawShoulder = isFrontal
      ? this.calculate2DAngleLandscape(shoulder, oppositeShoulder, elbow)
      : this.calculate2DAngleLandscape(shoulder, hip, elbow);

    if (isFrontal) {
      // Use PushupEngine's exact depth heuristic to fix Frontal Plank elbow detection
      const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const avgElbowY = (leftElbow.y + rightElbow.y) / 2;
      const avgWristY = (leftWrist.y + rightWrist.y) / 2;

      const denom = Math.max(0.01, Math.abs(avgWristY - avgShoulderY));
      const rawDepth = Math.abs(avgElbowY - avgShoulderY) / denom;

      // Forearm plank (elbow rests on floor near wrist): rawDepth > 0.5 -> 90 degrees
      // High plank / Pushup (elbow is high near shoulder): rawDepth < 0.5 -> 180 degrees
      rawElbow = rawDepth > 0.5 ? 90 : 180;
    } else {
      rawElbow = this.calculate2DAngleLandscape(elbow, shoulder, wrist);
    }

    rawKneeStr = this.calculate2DAngleLandscape(knee, hip, ankle);
    const expectedKneeY = (hip.y + ankle.y) / 2;
    const rawKneeSag = knee.y - expectedKneeY;

    // Apply Exponential Moving Average (EMA) smoothing
    if (!this.smoothedAngles) {
      this.smoothedAngles = { alignment: rawAlignment, shoulder: rawShoulder, elbow: rawElbow, kneeStr: rawKneeStr, kneeSag: rawKneeSag };
    } else {
      this.smoothedAngles.alignment += this.SMOOTHING_ALPHA * (rawAlignment - this.smoothedAngles.alignment);
      this.smoothedAngles.shoulder += this.SMOOTHING_ALPHA * (rawShoulder - this.smoothedAngles.shoulder);
      this.smoothedAngles.elbow += this.SMOOTHING_ALPHA * (rawElbow - this.smoothedAngles.elbow);
      this.smoothedAngles.kneeStr += this.SMOOTHING_ALPHA * (rawKneeStr - this.smoothedAngles.kneeStr);
      this.smoothedAngles.kneeSag += this.SMOOTHING_ALPHA * (rawKneeSag - this.smoothedAngles.kneeSag);
    }

    const currentAngles = {
      alignment: Math.round(this.smoothedAngles.alignment),
      shoulder: Math.round(this.smoothedAngles.shoulder),
      elbow: Math.round(this.smoothedAngles.elbow)
    };

    let isValid = false;
    let warningMessage = "Form broken. Timer paused.";

    // Kneeling plank detection: A kneeling plank drops the knee angle or causes the knee to sag downwards
    // (have a larger Y coordinate) below the straight line connecting the hip and ankle.
    // Reduced sag tolerance to 0.06 to allow breathing/micro-bends but strictly reject resting knees on the floor!
    const kneeStraight = this.smoothedAngles.kneeStr >= this.KNEE_STRAIGHT_THRESHOLD && this.smoothedAngles.kneeSag < 0.06;

    if (this.currentState === "VALID" && this.lockedAngles) {
      // Dynamic Form Locking
      const bDiff = Math.abs(currentAngles.alignment - this.lockedAngles.alignment);
      const sDiff = Math.abs(currentAngles.shoulder - this.lockedAngles.shoulder);
      const eDiff = Math.abs(currentAngles.elbow - this.lockedAngles.elbow);

      const bodyDx = Math.abs(shoulder.x - ankle.x);
      const bodyDy = Math.abs(shoulder.y - ankle.y);
      const isHorizontal = bodyDx > bodyDy * 0.5;

      isValid = bDiff <= this.BODY_TOLERANCE && sDiff <= this.ARM_TOLERANCE && eDiff <= this.ARM_TOLERANCE && kneeStraight && isHorizontal;

      if (!isValid) {
        if (!kneeStraight) warningMessage = "Keep your legs straight!";
        else if (bDiff > this.BODY_TOLERANCE) warningMessage = "Hips moving!";
        else if (sDiff > this.ARM_TOLERANCE) warningMessage = "Shoulders shifting!";
        else if (eDiff > this.ARM_TOLERANCE) warningMessage = "Arms moving!";
        else warningMessage = "Body alignment lost!";
      }
    } else {
      // Initial pose detection (Relaxed thresholds to ensure timer starts reliably)
      const isBodyStraight = currentAngles.alignment >= 125; // Decreased from 140 to allow higher hips
      const isPlankPose = currentAngles.shoulder >= 30 && currentAngles.shoulder <= 150 &&
        currentAngles.elbow >= 30 && currentAngles.elbow <= 140;

      // To prevent a user sitting/standing facing the camera from being falsely validated as a frontal plank,
      // we strictly enforce that the body must be horizontal on the camera frame (Side Profile).
      const bodyDx = Math.abs(shoulder.x - ankle.x);
      const bodyDy = Math.abs(shoulder.y - ankle.y);
      const isHorizontal = bodyDx > bodyDy * 0.5; // X width must be at least 50% of Y height (allows high planks/steep angles)

      isValid = isBodyStraight && isPlankPose && kneeStraight && isHorizontal;
      
      if (!kneeStraight) warningMessage = "Please keep your legs straight.";
      else if (!isPlankPose) warningMessage = "Rest your elbows on the surface.";
      else warningMessage = "Get into plank position.";
    }

    // State Transitions
    if (!isValid) {
      this.validFrames = 0;
      this.invalidFrames++;

      if (this.invalidFrames >= this.DEBOUNCE_FRAMES_STOP) {
        if (this.currentState !== "WARNING") {
          this.currentState = "WARNING";
          this.lockedAngles = null;
          return {
            type: "FORM_WARNING",
            message: warningMessage,
            angles: currentAngles
          };
        }
      }
    } else {
      this.invalidFrames = 0;
      this.validFrames++;

      if (this.validFrames >= this.DEBOUNCE_FRAMES_START && this.currentState !== "VALID") {
        this.currentState = "VALID";
        this.lockedAngles = { ...currentAngles };
        return {
          type: "FORM_VALID",
          message: "Perfect alignment. Timer running.",
          angles: currentAngles
        };
      }
    }

    return { type: "DEBUG_UPDATE", angles: currentAngles };
  }

  /**
   * Dedicated 2D angle calculator for Landscape mode.
   * Prevents aspect-ratio stretching that causes directional bias.
   */
  private calculate2DAngleLandscape(p1: Point3D, p2: Point3D, p3: Point3D): number {
    const width = 640;
    const height = 480;

    const v1 = {
      x: (p2.x - p1.x) * width,
      y: (p2.y - p1.y) * height,
    };

    const v2 = {
      x: (p3.x - p1.x) * width,
      y: (p3.y - p1.y) * height,
    };

    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 * mag2 === 0) return 0;

    let cosTheta = dotProduct / (mag1 * mag2);
    cosTheta = Math.max(-1, Math.min(1, cosTheta));

    return Math.acos(cosTheta) * (180.0 / Math.PI);
  }
}