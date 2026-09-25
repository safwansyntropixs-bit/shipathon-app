/**
 * Replix Camera Infrastructure
 * Wraps expo-camera APIs for permissions.
 * Note: The actual camera feed + pose detection is handled natively
 * via the custom PoseLandmarker module (modules/pose-landmarker).
 */

import { Camera } from "expo-camera";

class CameraService {
  /**
   * Request camera permissions from the OS.
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === "granted";
    } catch (err) {
      console.warn("Camera permission request failed:", err);
      return false;
    }
  }

  /**
   * Check current camera permissions without prompting.
   */
  async checkPermissions(): Promise<boolean> {
    const { status } = await Camera.getCameraPermissionsAsync();
    return status === "granted";
  }
}

export const cameraService = new CameraService();