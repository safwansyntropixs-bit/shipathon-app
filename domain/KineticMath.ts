export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export class KinematicMath {
  /**
   * Calculates the 3D angle between three joints using the vector dot product.
   *
   * @param p1 The central joint (e.g., Elbow)
   * @param p2 First adjacent joint (e.g., Shoulder)
   * @param p3 Second adjacent joint (e.g., Wrist)
   * @returns Angle in degrees
   */
  static calculateAngle(p1: Point3D, p2: Point3D, p3: Point3D): number {
    // Assuming Portrait 480x640 camera frame target resolution
    const width = 480;
    const height = 640;

    // Vector 1 (p1 to p2)
    const v1 = {
      x: (p2.x - p1.x) * width,
      y: (p2.y - p1.y) * height,
      z: (p2.z - p1.z) * width,
    };

    // Vector 2 (p1 to p3)
    const v2 = {
      x: (p3.x - p1.x) * width,
      y: (p3.y - p1.y) * height,
      z: (p3.z - p1.z) * width,
    };

    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

    // Prevent division by zero
    if (mag1 * mag2 === 0) return 0;

    let cosTheta = dotProduct / (mag1 * mag2);
    // Clamp to [-1, 1] to avoid NaN from floating point precision errors
    cosTheta = Math.max(-1, Math.min(1, cosTheta));

    const angleRad = Math.acos(cosTheta);
    return angleRad * (180.0 / Math.PI);
  }

  /**
   * Calculates the 2D angle (ignoring depth) between three joints.
   * Extremely useful for side-profile exercises where Z is noisy.
   */
  static calculate2DAngle(p1: Point3D, p2: Point3D, p3: Point3D): number {
    const width = 480;
    const height = 640;

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

  /**
   * Calculates the 2D angle (ignoring depth) between three joints assuming Landscape orientation.
   * X is scaled by 640, Y is scaled by 480.
   */
  static calculate2DAngleLandscape(p1: Point3D, p2: Point3D, p3: Point3D): number {
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

  /**
   * Validates if a landmark's confidence score meets the minimum threshold.
   * Increased to 0.70 to ensure strict full-body visibility and prevent irregular skeleton guessing.
   */
  static isVisible(landmark: Point3D | undefined, threshold = 0.70): boolean {
    if (!landmark) return false;
    
    // Strict boundary check: the point must physically be on the screen (with a tiny margin).
    // If MediaPipe guesses coordinates far outside the [0, 1] frame, they are invalid.
    const margin = 0.05;
    if (landmark.x < -margin || landmark.x > 1.0 + margin || landmark.y < -margin || landmark.y > 1.0 + margin) {
      return false;
    }
    
    if (landmark.visibility === undefined) return true;
    return landmark.visibility >= threshold;
  }
}
