import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

// OPTIMIZATION 1: React.memo
// Ab agar parent screen re-render ho bhi jaye, toh RippleRing khud ko re-render nahi karega unless props change hon.
export const RippleRing = React.memo(({ delay, color = "#3A9E66" }: { delay: number, color?: string }) => {
  const anim = useSharedValue(0);

  useEffect(() => {
    // 🚀 ZERO JS THREAD INVOLVEMENT
    anim.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(anim);
    };
    // OPTIMIZATION 2: Removed 'anim' from dependency array. 
    // useSharedValue hamesha stable reference return karta hai, usay track karne ki zaroorat nahi.
  }, [delay]);

  const style = useAnimatedStyle(() => {
    'worklet'; // UI thread execution only
    return {
      transform: [{ scale: 1 + anim.value * 2.5 }],
      opacity: 0.6 - anim.value * 0.6,
    };
  });

  return <Animated.View style={[styles.rippleRing, { backgroundColor: color }, style]} />;
});



export const SkeletonBlock = React.memo(({
  style,
  className,
  width,
  height,
  borderRadius = 16
}: {
  style?: any;
  className?: string;
  width?: any;
  height?: any;
  borderRadius?: number;
}) => {
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { backgroundColor: '#94B3A0', borderRadius, width, height },
        animStyle,
        style
      ]}
      className={className}
    />
  );
});

const styles = StyleSheet.create({
  rippleRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});