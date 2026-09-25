import { requireNativeViewManager } from "expo-modules-core";
import { PoseLandmarkerViewProps } from "./PoseLandmarker.types";

let PoseLandmarkerView: any;
let loadError: string | null = null;

try {
    PoseLandmarkerView = requireNativeViewManager<PoseLandmarkerViewProps>("PoseLandmarker");
} catch (e: any) {
    loadError = String(e?.message || e);
    console.error("Failed to load PoseLandmarker native module:", e);
}

export { loadError, PoseLandmarkerView };
