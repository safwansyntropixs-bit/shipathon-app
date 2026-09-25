export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

export type CameraWarning = {
  facing: string;
  megapixels: number;
  message: string;
};

export type PoseLandmarkerViewProps = {
  style?: any;
  cameraFacing?: "front" | "back";
  onLandmarks?: (event: { nativeEvent: { landmarks: Landmark[] } }) => void;
  onCameraWarning?: (event: { nativeEvent: CameraWarning }) => void;
};

export type PoseLandmarkerModuleEvents = {
  onChange: (params: { value: string }) => void;
};