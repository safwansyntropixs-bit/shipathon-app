import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  useDerivedValue,
  cancelAnimation,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Line, Circle } from 'react-native-svg';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// OPTIMIZATION 1: Math functions ko component se bahar nikal diya.
// Ab har render par inki memory dubara allocate nahi hogi.
const getPushupJoints = (p: number) => {
  'worklet';
  const dipY = p * 15;
  return {
    head: { x: 75, y: 35 + dipY },
    shoulder: { x: 65, y: 40 + dipY },
    hip: { x: 45, y: 45 + dipY * 0.5 },
    knee: { x: 25, y: 55 },
    foot: { x: 10, y: 65 },
    elbow: { x: 60, y: 55 + dipY * 0.2 },
    hand: { x: 65, y: 70 },
  };
};

const getSquatJoints = (p: number) => {
  'worklet';
  const dipY = p * 30;
  const dipX = p * 10;
  return {
    head: { x: 50 + dipX * 0.5, y: 20 + dipY },
    shoulder: { x: 50 + dipX * 0.2, y: 35 + dipY },
    hip: { x: 50 - dipX, y: 55 + dipY },
    knee: { x: 50 + dipX * 1.5, y: 75 + dipY * 0.2 },
    foot: { x: 50 + dipX * 0.5, y: 90 },
    elbow: { x: 65 + dipX, y: 50 + dipY * 0.8 },
    hand: { x: 75 + dipX * 1.5, y: 45 + dipY * 0.5 },
  };
};

const getPlankJoints = (p: number) => {
  'worklet';
  const breatheY = p * 2;
  return {
    head: { x: 75, y: 40 + breatheY },
    shoulder: { x: 65, y: 45 + breatheY },
    hip: { x: 40, y: 48 + breatheY },
    knee: { x: 20, y: 53 + breatheY },
    foot: { x: 5, y: 58 },
    elbow: { x: 60, y: 60 },
    hand: { x: 70, y: 62 },
  };
};

type JointKeys = keyof ReturnType<typeof getPushupJoints>;

// OPTIMIZATION 2: Hook Violation Fix & Sub-Components
// React Hooks loops mein allow nahi hote. Inhe alag memoized components mein move kiya gaya.
const SkeletonLine = React.memo(({ j1, j2, jointsData, color }: { j1: JointKeys, j2: JointKeys, jointsData: SharedValue<ReturnType<typeof getPushupJoints>>, color: string }) => {
  const animatedProps = useAnimatedProps(() => {
    const joint1 = jointsData.value[j1];
    const joint2 = jointsData.value[j2];
    return {
      x1: joint1.x.toString(),
      y1: joint1.y.toString(),
      x2: joint2.x.toString(),
      y2: joint2.y.toString(),
    };
  });
  return <AnimatedLine animatedProps={animatedProps} stroke={color} strokeWidth="3" strokeLinecap="round" />;
});

const SkeletonJoint = React.memo(({ joint, jointsData, color, radius }: { joint: JointKeys, jointsData: SharedValue<ReturnType<typeof getPushupJoints>>, color: string, radius: string }) => {
  const animatedProps = useAnimatedProps(() => {
    const j = jointsData.value[joint];
    return {
      cx: j.x.toString(),
      cy: j.y.toString(),
    };
  });
  return <AnimatedCircle animatedProps={animatedProps} r={radius} fill={color} />;
});

// Static arrays bahar move kar diye taake memory na khayen
const LINES: [JointKeys, JointKeys][] = [
  ['head', 'shoulder'],
  ['shoulder', 'hip'],
  ['hip', 'knee'],
  ['knee', 'foot'],
  ['shoulder', 'elbow'],
  ['elbow', 'hand'],
];
const JOINTS: JointKeys[] = ['head', 'shoulder', 'hip', 'knee', 'foot', 'elbow', 'hand'];

interface AnimatedSkeletonBackgroundProps {
  type: 'pushups' | 'squats' | 'planks';
  color?: string;
  opacity?: number;
}

// OPTIMIZATION 3: React.memo on Main Background
export const AnimatedSkeletonBackground = React.memo(({
  type,
  color = '#3A9E66',
  opacity = 0.15,
}: AnimatedSkeletonBackgroundProps) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Memory Leak Fix: Unmount par animation cancel karni chahiye
    return () => {
      cancelAnimation(progress);
    };
  }, []);

  // OPTIMIZATION 4: SINGLE CALCULATION PER FRAME
  // Har frame par joints sirf ek dafa calculate honge, bajaye 13 dafa hone ke.
  const jointsData = useDerivedValue(() => {
    if (type === 'pushups') return getPushupJoints(progress.value);
    if (type === 'squats') return getSquatJoints(progress.value);
    return getPlankJoints(progress.value);
  }, [type]); 

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        {LINES.map(([j1, j2]) => (
          <SkeletonLine key={`${j1}-${j2}`} j1={j1} j2={j2} jointsData={jointsData} color={color} />
        ))}
        {JOINTS.map((joint) => (
          <SkeletonJoint
            key={joint}
            joint={joint}
            jointsData={jointsData}
            color={color}
            radius={joint === 'head' ? '6' : '3'}
          />
        ))}
      </Svg>
    </View>
  );
});