import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

interface AmbientProps {
  color?: string;
  opacity?: number;
}

const AnimatedTopGlow = ({ color = '#3A9E66', opacity = 0.25 }: AmbientProps) => {
  const translateY = useSharedValue(-30);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-30, { duration: 4000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, zIndex: 0 }, animatedStyle]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="topGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="50%" stopColor={color} stopOpacity={opacity * 0.2} />
            <Stop offset="100%" stopColor="#050505" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#topGlow)" />
      </Svg>
    </Animated.View>
  );
};

export const PremiumAmbientBackground = ({ color = '#3A9E66', opacity = 0.10 }: AmbientProps) => {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#050505', zIndex: -1 }} pointerEvents="none">

      {/* 1. Subtle Dot Grid Pattern for Aesthetic Texture */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="dotGrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <Circle cx="2" cy="2" r="1.2" fill="#FFFFFF" opacity="0.05" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dotGrid)" />
        </Svg>
      </View>

      <AnimatedTopGlow color={color} opacity={opacity * 2.5} />

      <View style={{ position: 'absolute', top: -100, left: -50, width: 400, height: 400, zIndex: 0 }} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="mainGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#mainGlow)" />
        </Svg>
      </View>

      <View style={{ position: 'absolute', top: '40%', right: -100, width: 300, height: 300, zIndex: 0 }} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="sideGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={color} stopOpacity={opacity * 0.8} />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sideGlow)" />
        </Svg>
      </View>
    </View>
  );
};
