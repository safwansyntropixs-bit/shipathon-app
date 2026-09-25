import { registerWebModule, NativeModule } from 'expo';

import { PoseLandmarkerModuleEvents } from './PoseLandmarker.types';

// PoseLandmarkerModule is not available on the web platform.
class PoseLandmarkerModule extends NativeModule<PoseLandmarkerModuleEvents> {}

export default registerWebModule(PoseLandmarkerModule, 'PoseLandmarkerModule');
