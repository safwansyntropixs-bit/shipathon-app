import { NativeModule, requireNativeModule } from 'expo';

import { PoseLandmarkerModuleEvents } from './PoseLandmarker.types';

declare class PoseLandmarkerModule extends NativeModule<PoseLandmarkerModuleEvents> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<PoseLandmarkerModule>('PoseLandmarker');
