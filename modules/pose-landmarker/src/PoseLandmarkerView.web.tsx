import { PoseLandmarkerViewProps } from './PoseLandmarker.types';

// PoseLandmarkerView is not available on the web platform.
export default function PoseLandmarkerView(_props: PoseLandmarkerViewProps) {
  throw new Error('PoseLandmarkerView is not available on the web platform.');
}
