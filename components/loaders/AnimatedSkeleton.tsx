import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useDerivedValue, 
  withRepeat, 
  withTiming, 
  Easing
} from 'react-native-reanimated';
import { Canvas, Path as SkiaPath, Skia } from '@shopify/react-native-skia';

// --- EXACT SAME POSES (Koi math change nahi kiya) ---
const getSquatPose = (dipAmount: number) => {
  'worklet';
  const bodyDrop = dipAmount * 8;
  return {
    head: { x: 50, y: 26 + bodyDrop }, neck: { x: 50, y: 38 + bodyDrop },
    shoulderL: { x: 40, y: 38 + bodyDrop }, shoulderR: { x: 60, y: 38 + bodyDrop },
    elbowL: { x: 36, y: 50 + bodyDrop }, elbowR: { x: 64, y: 50 + bodyDrop },
    wristL: { x: 33, y: 55 + bodyDrop }, wristR: { x: 67, y: 55 + bodyDrop },
    hipL: { x: 43, y: 68 + dipAmount * 12 }, hipR: { x: 57, y: 68 + dipAmount * 12 },
    kneeL: { x: 38 + dipAmount * 1.5, y: 78 + dipAmount * 2 },
    kneeR: { x: 62 - dipAmount * 1.5, y: 78 + dipAmount * 2 },
    ankleL: { x: 32, y: 85 }, ankleR: { x: 68, y: 85 },
  };
};

const getPushupPose = (dip: number) => {
  'worklet';
  return {
    ankleL: { x: 47, y: 45 + dip * 2 }, ankleR: { x: 53, y: 45 + dip * 2 },
    kneeL: { x: 45, y: 52 + dip * 4 }, kneeR: { x: 55, y: 52 + dip * 4 },
    hipL: { x: 42, y: 59 + dip * 7 }, hipR: { x: 58, y: 59 + dip * 7 },
    shoulderL: { x: 37 - dip * 2, y: 66 + dip * 10 }, shoulderR: { x: 63 + dip * 2, y: 66 + dip * 10 },
    neck: { x: 50, y: 62 + dip * 11 }, head: { x: 50, y: 55 + dip * 12 },
    wristL: { x: 34, y: 78 }, wristR: { x: 66, y: 78 },
    elbowL: { x: 28 - dip * 8, y: 72 + dip * 5 }, elbowR: { x: 72 + dip * 8, y: 72 + dip * 5 },
  };
};

const getPlankPose = (breath: number) => {
  'worklet';
  return {
    ankleL: { x: 47, y: 47 + breath * 0.3 }, ankleR: { x: 53, y: 47 + breath * 0.3 },
    kneeL: { x: 45, y: 54 + breath * 0.5 }, kneeR: { x: 55, y: 54 + breath * 0.5 },
    hipL: { x: 42, y: 61 + breath * 0.8 }, hipR: { x: 58, y: 61 + breath * 0.8 },
    shoulderL: { x: 36, y: 68 + breath }, shoulderR: { x: 64, y: 68 + breath },
    neck: { x: 50, y: 64 + breath }, head: { x: 50, y: 58 + breath },
    elbowL: { x: 34, y: 81 }, elbowR: { x: 66, y: 81 },
    wristL: { x: 40, y: 84 }, wristR: { x: 60, y: 84 },
  };
};

const blendPoses = (poseA: Record<string, { x: number, y: number }>, poseB: Record<string, { x: number, y: number }>, t: number) => {
  'worklet';
  const easeT = Math.max(0, Math.min(1, t * t * (3 - 2 * t)));
  const result: any = {};
  const keys = ['head', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    result[key] = { x: poseA[key].x + (poseB[key].x - poseA[key].x) * easeT, y: poseA[key].y + (poseB[key].y - poseA[key].y) * easeT };
  }
  return result;
};

export const AnimatedSkeleton = React.memo(({ exercise, size = 60 }: { exercise: 'squat' | 'pushup' | 'plank' | 'all', size?: number }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    const timeout = setTimeout(() => {
      if (exercise === 'all') {
        progress.value = withRepeat(withTiming(24.0, { duration: 15000, easing: Easing.linear }), -1, false);
      } else {
        progress.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [exercise]);

  const pose = useDerivedValue(() => {
    'worklet';
    if (exercise === 'all') {
      const val = progress.value;
      if (val < 7.2) return getSquatPose(Math.sin(((val % 3.6) / 3.6) * Math.PI));
      else if (val < 8.0) return blendPoses(getSquatPose(0), getPushupPose(0), (val - 7.2) / 0.8);
      else if (val < 15.2) return getPushupPose(Math.sin((((val - 8.0) % 3.6) / 3.6) * Math.PI));
      else if (val < 16.0) return blendPoses(getPushupPose(0), getPlankPose(0), (val - 15.2) / 0.8);
      else if (val < 23.2) return getPlankPose(Math.sin(((val - 16.0) / 7.2) * Math.PI) * 1.5);
      else return blendPoses(getPlankPose(0), getSquatPose(0), (val - 23.2) / 0.8);
    }
    if (exercise === 'squat') return getSquatPose((Math.sin((progress.value * 2 - 0.5) * Math.PI) + 1) / 2);
    else if (exercise === 'pushup') return getPushupPose((Math.sin((progress.value * 2 - 0.5) * Math.PI) + 1) / 2);
    else return getPlankPose(Math.sin(progress.value * Math.PI * 2) * 1.5);
  });

  // 1. Skia se bones draw karna (Zero String Parsing)
  const bonesPath = useDerivedValue(() => {
    const p = pose.value;
    const path = Skia.Path.Make();
    const m = size / 100; // Scaling factor

    const drawLine = (p1: any, p2: any) => {
      path.moveTo(p1.x * m, p1.y * m);
      path.lineTo(p2.x * m, p2.y * m);
    };

    drawLine(p.head, p.neck);
    drawLine(p.shoulderL, p.shoulderR);
    drawLine(p.shoulderL, p.elbowL); drawLine(p.elbowL, p.wristL);
    drawLine(p.shoulderR, p.elbowR); drawLine(p.elbowR, p.wristR);
    drawLine(p.shoulderL, p.hipL); drawLine(p.shoulderR, p.hipR);
    drawLine(p.hipL, p.hipR);
    drawLine(p.hipL, p.kneeL); drawLine(p.kneeL, p.ankleL);
    drawLine(p.hipR, p.kneeR); drawLine(p.kneeR, p.ankleR);

    return path;
  });

  // 2. Skia se joints draw karna 
  const jointsPath = useDerivedValue(() => {
    const p = pose.value;
    const path = Skia.Path.Make();
    const m = size / 100;
    const joints = [
      p.shoulderL, p.shoulderR, p.elbowL, p.wristL, p.elbowR, p.wristR,
      p.hipL, p.hipR, p.kneeL, p.ankleL, p.kneeR, p.ankleR
    ];
    
    for (let i = 0; i < joints.length; i++) {
      path.addCircle(joints[i].x * m, joints[i].y * m, 1.5 * m);
    }
    return path;
  });

  // 3. Skia se Head draw karna
  const headPath = useDerivedValue(() => {
    const p = pose.value;
    const path = Skia.Path.Make();
    const m = size / 100;
    path.addCircle(p.head.x * m, p.head.y * m, 3 * m);
    return path;
  });

  const m = size / 100;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ flex: 1 }}>
        {/* BONES */}
        <SkiaPath 
          path={bonesPath} 
          color="#3A9E66" 
          style="stroke" 
          strokeWidth={2.5 * m} 
          strokeCap="round" 
          strokeJoin="round" 
        />
        
        {/* JOINTS (Fill + Stroke) */}
        <SkiaPath path={jointsPath} color="#94BCA1" style="fill" />
        <SkiaPath path={jointsPath} color="#2F6B47" style="stroke" strokeWidth={1 * m} />
        
        {/* HEAD */}
        <SkiaPath path={headPath} color="#2F6B47" style="fill" />
      </Canvas>
    </View>
  );
});