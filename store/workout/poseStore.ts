import { create } from "zustand";
import { Point3D } from "../../domain/KineticMath";
import { PoseValidationStatus } from "../../services/workout/poseService";
import { PoseSmoother } from "../../services/workout/poseSmoother";

// Alpha 0.6 matches our new snappy UI requirement
const poseSmoother = new PoseSmoother(0.6);

interface PoseState {
  landmarks: Point3D[];
  validationStatus: PoseValidationStatus;
  isDetecting: boolean;
  fps: number;
  frameTimestamps: number[];
  imageWidth: number;
  imageHeight: number;

  setPoseData: (landmarks: Point3D[], status: PoseValidationStatus, imageWidth?: number, imageHeight?: number) => void;
  setIsDetecting: (isDetecting: boolean) => void;
  clearPose: () => void;
}

export const usePoseStore = create<PoseState>((set, get) => ({
  landmarks: [],
  validationStatus: PoseValidationStatus.NO_DETECTION,
  isDetecting: false,
  fps: 0,
  frameTimestamps: [],
  imageWidth: 0,
  imageHeight: 0,

  setPoseData: (rawLandmarks, validationStatus, imageWidth = 0, imageHeight = 0) => {
    // If the pose is invalid, reset the smoother immediately so it doesn't get stuck
    if (validationStatus !== PoseValidationStatus.VALID) {
      poseSmoother.reset();
      set({ landmarks: [], validationStatus });
      return;
    }

    const smoothedLandmarks = poseSmoother.smooth(rawLandmarks);

    // Simplified FPS calculation to save JS thread overhead
    const now = performance.now();
    const timestamps = get().frameTimestamps;
    const newTimestamps = [...timestamps, now].slice(-15); // Reduced array size

    let currentFps = get().fps;
    if (newTimestamps.length > 1) {
      const elapsed = newTimestamps[newTimestamps.length - 1] - newTimestamps[0];
      currentFps = elapsed > 0 ? Math.round((newTimestamps.length / elapsed) * 1000) : currentFps;
    }

    set({ 
      landmarks: smoothedLandmarks, 
      validationStatus, 
      frameTimestamps: newTimestamps, 
      fps: currentFps,
      ...(imageWidth > 0 && imageHeight > 0 ? { imageWidth, imageHeight } : {})
    });
  },

  setIsDetecting: (isDetecting) => {
    set({ isDetecting });
  },

  clearPose: () => {
    poseSmoother.reset(); // Crucial: clear memory on exit
    set({
      landmarks: [],
      validationStatus: PoseValidationStatus.NO_DETECTION,
      isDetecting: false,
      fps: 0,
      frameTimestamps: [],
    });
  },
}));