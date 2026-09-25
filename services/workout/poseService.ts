import { Point3D } from "../../domain/KineticMath";

export enum PoseValidationStatus {
  VALID = "VALID",
  OUT_OF_FRAME = "OUT_OF_FRAME",
  LOW_CONFIDENCE = "LOW_CONFIDENCE",
  NO_DETECTION = "NO_DETECTION",
  HALLUCINATION = "HALLUCINATION",
  PARTIAL_BODY = "PARTIAL_BODY",
}

class PoseService {
  parseLandmarks(rawOutput: any[] | Float32Array | Float64Array | undefined): Point3D[] {
    if (!rawOutput || rawOutput.length === 0) return [];

    const landmarks: Point3D[] = [];
    const elementsPerPoint = rawOutput.length % 33 === 0 ? Math.floor(rawOutput.length / 33) :
      rawOutput.length % 17 === 0 ? Math.floor(rawOutput.length / 17) : 3;

    for (let i = 0; i < rawOutput.length; i += elementsPerPoint) {
      if (elementsPerPoint === 3) {
        landmarks.push({
          y: Number(rawOutput[i]),
          x: Number(rawOutput[i + 1]),
          z: 0,
          visibility: Number(rawOutput[i + 2]),
        });
      } else if (elementsPerPoint >= 4) {
        landmarks.push({
          x: Number(rawOutput[i]),
          y: Number(rawOutput[i + 1]),
          z: Number(rawOutput[i + 2]),
          visibility: Number(rawOutput[i + 3]),
        });
      }
    }

    return landmarks;
  }

  validatePose(landmarks: Point3D[]): PoseValidationStatus {
    if (landmarks.length === 0) {
      return PoseValidationStatus.NO_DETECTION;
    }

    // Lowered slightly to 0.5 so floor exercises aren't incorrectly rejected by shadows
    const CONFIDENCE_THRESHOLD = 0.5;

    // The face has 11 landmarks which can easily inflate the count and falsely trigger VALID.
    // We must ensure the actual core body is in frame.
    const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    let visibleKeyJointsCount = 0;

    let hasShoulder = false;
    let hasElbow = false;
    let hasHip = false;
    let hasKnee = false;
    let hasAnkle = false;

    let validShoulder: Point3D | null = null;
    let validElbow: Point3D | null = null;
    let validHip: Point3D | null = null;
    let validKnee: Point3D | null = null;

    for (const index of keyJoints) {
      const point = landmarks[index];
      if (point && point.visibility !== undefined && point.visibility >= CONFIDENCE_THRESHOLD) {
        // STRICT BOUNDARY CHECK: Must be mathematically on the screen.
        if (point.x >= 0.05 && point.x <= 0.95 && point.y >= 0.05 && point.y <= 0.95) {
          visibleKeyJointsCount++;
          if (index === 11 || index === 12) { hasShoulder = true; validShoulder = point; }
          if (index === 13 || index === 14) { hasElbow = true; validElbow = point; }
          if (index === 23 || index === 24) { hasHip = true; validHip = point; }
          if (index === 25 || index === 26) { hasKnee = true; validKnee = point; }
          if (index === 27 || index === 28) { hasAnkle = true; }
        }
      }
    }

    const hasLowerBody = hasHip && hasKnee;
    const hasUpperBody = hasShoulder && hasElbow;

    // Require at least 4 key body joints AND either a functional upper body or lower body
    if (visibleKeyJointsCount < 4 || (!hasLowerBody && !hasUpperBody)) {
      return PoseValidationStatus.OUT_OF_FRAME;
    }

    // HEADLESS GHOST REJECTION: Furniture (like sofas/clothes) do not have faces.
    // MediaPipe often maps limbs to fabric folds but fails to confidently map facial features.
    // We require at least one facial landmark with HIGH confidence (0.85) to prove a real human is present.
    let hasFace = false;
    for (let i = 0; i <= 10; i++) {
      if (landmarks[i] && (landmarks[i].visibility ?? 0) >= 0.85) {
        hasFace = true;
        break;
      }
    }
    if (!hasFace) {
      return PoseValidationStatus.HALLUCINATION;
    }

    // 2D VIDEO PLAYBACK REJECTION (Screen Cheating)
    // If a user plays a YouTube video of a workout on a laptop or phone, the actual person 
    // inside that video will occupy a very small fraction of the total camera frame.
    // A real human doing a floor workout physically occupies at least 12% of the total camera frame area.
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const pt of landmarks) {
      if ((pt.visibility ?? 0) > 0.5) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    // A real human taking up the frame will almost always have a bounding box height > 40% (0.4) 
    // or a width > 40% (0.4) if doing planks. 
    // If BOTH width and height are small (< 0.35), it's a tiny screen playing a video.
    if (boxWidth < 0.35 && boxHeight < 0.35) {
      return PoseValidationStatus.HALLUCINATION;
    }

    // HALLUCINATION REJECTION: A ghost skeleton detected on furniture will have highly compressed joints.
    // Calculate the physical distance of major body segments (Torso, Femur, or Upper Arm).
    let maxSegmentLength = 0;

    if (validShoulder && validHip) {
      const dx = validShoulder.x - validHip.x;
      const dy = validShoulder.y - validHip.y;
      maxSegmentLength = Math.max(maxSegmentLength, Math.sqrt(dx * dx + dy * dy));
    }
    if (validHip && validKnee) {
      const dx = validHip.x - validKnee.x;
      const dy = validHip.y - validKnee.y;
      maxSegmentLength = Math.max(maxSegmentLength, Math.sqrt(dx * dx + dy * dy));
    }
    if (validShoulder && validElbow) {
      const dx = validShoulder.x - validElbow.x;
      const dy = validShoulder.y - validElbow.y;
      maxSegmentLength = Math.max(maxSegmentLength, Math.sqrt(dx * dx + dy * dy));
    }

    // A real human taking up the frame will have a segment length > 8% of the screen.
    // Deep squats foreshorten the 2D projection, so 0.15 was too strict. Ghost skeletons are usually < 5%.
    if (maxSegmentLength > 0 && maxSegmentLength < 0.08) {
      return PoseValidationStatus.HALLUCINATION;
    }
    
    // UPSIDE DOWN / TANGLED CHECK (Head comes to feet)
    // If the nose is physically rendered significantly below the knees (y goes from 0 top to 1 bottom).
    // Relaxed to 0.35 to allow for deep squats, burpees, and floor exercises without false rejections.
    const nose = landmarks[0];
    if (nose && validKnee && nose.y > validKnee.y + 0.35) {
      return PoseValidationStatus.HALLUCINATION;
    }

    // FULL BODY CHECK: Ensure user isn't cheating by hiding joints
    const isFullBody = hasShoulder && hasHip && hasKnee && hasAnkle;
    if (!isFullBody) {
      return PoseValidationStatus.PARTIAL_BODY;
    }

    return PoseValidationStatus.VALID;
  }
}

export const poseService = new PoseService();