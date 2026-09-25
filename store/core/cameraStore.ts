import { create } from "zustand";
import { cameraService } from "../../services/core/cameraService";

interface CameraState {
  permissionGranted: boolean | null;
  isActive: boolean;
  isProcessing: boolean;
  error: string | null;

  requestPermissions: () => Promise<boolean>;
  checkPermissions: () => Promise<void>;
  startCamera: () => void;
  stopCamera: () => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
}

export const useCameraStore = create<CameraState>((set, get) => ({
  permissionGranted: null,
  isActive: false,
  isProcessing: false,
  error: null,

  requestPermissions: async () => {
    try {
      const granted = await cameraService.requestPermissions();
      set({ permissionGranted: granted });
      if (!granted) {
        set({ error: "Camera permission was denied." });
      }
      return granted;
    } catch (err: any) {
      set({
        permissionGranted: false,
        error: err.message || "Error requesting permissions.",
      });
      return false;
    }
  },

  checkPermissions: async () => {
    const granted = await cameraService.checkPermissions();
    set({ permissionGranted: granted });
  },

  startCamera: () => {
    const { permissionGranted } = get();
    if (permissionGranted) {
      set({ isActive: true, error: null });
    } else {
      set({ error: "Cannot start camera: permissions not granted." });
    }
  },

  stopCamera: () => {
    set({ isActive: false, isProcessing: false });
  },

  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },

  setError: (error) => set({ error }),
}));