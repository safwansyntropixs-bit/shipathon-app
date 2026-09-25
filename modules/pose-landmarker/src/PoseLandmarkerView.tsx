import { requireNativeView } from 'expo';
import * as React from 'react';

import { PoseLandmarkerViewProps } from './PoseLandmarker.types';

const NativeView: React.ComponentType<PoseLandmarkerViewProps> = requireNativeView('PoseLandmarker');

export default function PoseLandmarkerView(props: PoseLandmarkerViewProps) {
  return <NativeView {...props} />;
}
