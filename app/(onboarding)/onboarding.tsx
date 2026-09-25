import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight, BarChart3, ChevronRight, Sparkles, Trophy } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  StatusBar,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PremiumAmbientBackground } from '../../components/layout/PremiumAmbientBackground';
import { storageService } from '../../services/core/storageService';
// Native C++ UI thread animation components and worklets
import AnimatedReanimated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming
} from 'react-native-reanimated';
// Skia: The Ultimate 60FPS Engine for dynamic rendering
import { Canvas, Skia, Path as SkiaPath } from '@shopify/react-native-skia';

// ==========================================
// ==========================================
// 1. Swipe To Start Button Component
// ==========================================

const SwipeToStartButton: React.FC<{ onComplete: () => void, label?: string }> = ({
  onComplete, label = "SLIDE TO START"
}) => {
  const [, setIsCompleted] = useState(false);
  const isCompletedShared = useSharedValue(false);
  const containerWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const handleSize = 44;

  useFocusEffect(
    React.useCallback(() => {
      setIsCompleted(false);
      isCompletedShared.value = false;
      translateX.value = 0;
    }, [translateX])
  );

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (isCompletedShared.value) return;
      const maxDrag = Math.max(0, containerWidth.value - handleSize - 8);
      // Clean clamping math for zero jitter
      translateX.value = Math.max(0, Math.min(e.translationX, maxDrag));
    })
    .onEnd((e) => {
      if (isCompletedShared.value) return;
      const maxDrag = Math.max(0, containerWidth.value - handleSize - 8);
      if (e.translationX > maxDrag * 0.7) {
        isCompletedShared.value = true;
        runOnJS(setIsCompleted)(true);
        translateX.value = withSpring(maxDrag, { damping: 20, stiffness: 180, overshootClamping: true }, (finished) => {
          if (finished) runOnJS(onComplete)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 25, stiffness: 200, overshootClamping: true });
      }
    });

  const fillStyle = useAnimatedStyle(() => {
    const clampedX = Math.max(0, Math.min(translateX.value, Math.max(0, containerWidth.value - handleSize - 8)));
    return {
      width: clampedX + handleSize + 4,
    };
  });

  const knobStyle = useAnimatedStyle(() => {
    const clampedX = Math.max(0, Math.min(translateX.value, Math.max(0, containerWidth.value - handleSize - 8)));
    return {
      transform: [{ translateX: clampedX }]
    };
  });

  return (
    <View
      className="w-full h-16 bg-[#18181B] rounded-full p-1 overflow-hidden flex-row items-center justify-between border border-[#27272A]"
      onLayout={(e) => containerWidth.value = e.nativeEvent.layout.width}
    >
      <AnimatedReanimated.View
        className="absolute left-0 top-0 bottom-0 bg-[#2F6B47] opacity-20 rounded-full"
        style={fillStyle}
      />
      <View className="absolute inset-0 items-center justify-center pointer-events-none">
        <Text className="font-outfitMed text-[11px] uppercase tracking-[4px] text-[#A1A1AA]">
          {label}
        </Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <AnimatedReanimated.View
          className="w-11 h-11 rounded-full bg-[#3A9E66] items-center justify-center z-10"
          style={knobStyle}
        >
          <ArrowRight size={20} color="#FFFFFF" />
        </AnimatedReanimated.View>
      </GestureDetector>
      <View className="pr-4 pointer-events-none opacity-30">
        <ChevronRight size={16} color="#FFFFFF" />
      </View>
    </View>
  );
};

// ==========================================
// 3. Pose Engine Skeleton Box Component (SKIA POWERED 🚀)
// ==========================================

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

const blendPoses = (poseA: any, poseB: any, t: number) => {
  'worklet';
  const easeT = Math.max(0, Math.min(1, t * t * (3 - 2 * t)));
  const result: any = {};
  const keys = ['head', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    result[key] = {
      x: poseA[key].x + (poseB[key].x - poseA[key].x) * easeT,
      y: poseA[key].y + (poseB[key].y - poseA[key].y) * easeT,
    };
  }
  return result;
};

export const PoseEngineSkeletonBox: React.FC<{ activeTab?: number }> = () => {
  const animProgress = useSharedValue(0);

  useEffect(() => {
    animProgress.value = withRepeat(
      withTiming(24.0, { duration: 15000, easing: ReanimatedEasing.linear }), -1, false
    );
  }, []);

  const pose = useDerivedValue(() => {
    'worklet';
    const val = animProgress.value;
    if (val < 7.2) return getSquatPose(Math.sin(((val % 3.6) / 3.6) * Math.PI));
    else if (val < 8.0) return blendPoses(getSquatPose(0), getPushupPose(0), (val - 7.2) / 0.8);
    else if (val < 15.2) return getPushupPose(Math.sin((((val - 8.0) % 3.6) / 3.6) * Math.PI));
    else if (val < 16.0) return blendPoses(getPushupPose(0), getPlankPose(0), (val - 15.2) / 0.8);
    else if (val < 23.2) return getPlankPose(Math.sin(((val - 16.0) / 7.2) * Math.PI) * 1.5);
    else return blendPoses(getPlankPose(0), getSquatPose(0), (val - 23.2) / 0.8);
  });

  // Skia Paths logic (Replaces heavy SVG Strings)
  const boxSize = 200; // Physical size mapped from original viewBox (100 -> 200 means scale by 2)
  const scale = boxSize / 100;

  const bonesPath = useDerivedValue(() => {
    const p = pose.value;
    const path = Skia.Path.Make();
    const drawLine = (p1: any, p2: any) => {
      path.moveTo(p1.x * scale, p1.y * scale);
      path.lineTo(p2.x * scale, p2.y * scale);
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

  const jointsPath = useDerivedValue(() => {
    const p = pose.value;
    const path = Skia.Path.Make();
    const joints = [
      p.shoulderL, p.shoulderR, p.elbowL, p.wristL, p.elbowR, p.wristR,
      p.hipL, p.hipR, p.kneeL, p.ankleL, p.kneeR, p.ankleR
    ];
    for (let i = 0; i < joints.length; i++) {
      path.addCircle(joints[i].x * scale, joints[i].y * scale, 1.5 * scale);
    }
    return path;
  });

  const headPath = useDerivedValue(() => {
    const p = pose.value;
    const path = Skia.Path.Make();
    path.addCircle(p.head.x * scale, p.head.y * scale, 3 * scale);
    return path;
  });

  const modeTranslateY = useDerivedValue(() => {
    'worklet';
    const val = animProgress.value;
    let idx = 0;
    if (val >= 23.2) idx = 0; else if (val >= 15.2) idx = 2; else if (val >= 7.2) idx = 1; else idx = 0;
    return withSpring(-idx * 18, { damping: 18, stiffness: 120 });
  });

  const counterTranslateY = useDerivedValue(() => {
    'worklet';
    const val = animProgress.value;
    let idx = 0;
    if (val < 3.6) idx = 0; else if (val < 7.2) idx = 1; else if (val < 8.0) idx = 2; else if (val < 11.6) idx = 0; else if (val < 15.2) idx = 1; else if (val < 16.0) idx = 2; else if (val < 19.6) idx = 0; else if (val < 23.2) idx = 1; else idx = 2;
    return withSpring(-idx * 18, { damping: 18, stiffness: 120 });
  });

  const isPlankVal = useDerivedValue(() => {
    'worklet';
    return animProgress.value >= 15.2 && animProgress.value < 23.2 ? 1 : 0;
  });

  const plankSuffixStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isPlankVal.value, { duration: 150 }),
  }));
  const modeAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: modeTranslateY.value }] }));
  const counterAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: counterTranslateY.value }] }));

  const pulseAnim = useSharedValue(0);
  useEffect(() => {
    pulseAnim.value = withRepeat(withTiming(1, { duration: 1200, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) }), -1, false);
    return () => cancelAnimation(pulseAnim);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 2.2]) }],
    opacity: interpolate(pulseAnim.value, [0, 1], [0.8, 0]),
  }));

  return (
    <View className="w-full h-[210px] bg-[#0A0A0A] rounded-[16px] border border-[#1A1A1A] relative overflow-hidden items-center justify-center shadow-lg">
      <View className="absolute top-4 left-4 w-4 h-4 border-t border-l border-[#3F3F46] pointer-events-none" />
      <View className="absolute top-4 right-4 w-4 h-4 border-t border-r border-[#3F3F46] pointer-events-none" />
      <View className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-[#3F3F46] pointer-events-none" />
      <View className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-[#3F3F46] pointer-events-none" />

      <View className="absolute top-3 left-10 bg-[#09090B] border border-[#27272A] rounded-lg px-2 py-1.5 flex-row items-center justify-between z-10 min-w-[110px]">
        <View className="h-[18px] w-[50px] overflow-hidden">
          <AnimatedReanimated.View style={modeAnimatedStyle}>
            {['SQUAT', 'PUSHUP', 'PLANK'].map((m) => (
              <View key={m} className="h-[18px] justify-center">
                <Text className="font-outfitBold text-[11px] tracking-widest text-white uppercase">{m}</Text>
              </View>
            ))}
          </AnimatedReanimated.View>
        </View>
        <View className="h-[18px] flex-row items-center ml-auto">
          <View className="h-[18px] w-[14px] overflow-hidden">
            <AnimatedReanimated.View style={counterAnimatedStyle}>
              {['0', '1', '2'].map((val) => (
                <View key={val} className="h-[18px] w-[14px] items-center justify-center">
                  <Text className="font-outfitBold text-[13px] text-[#4ADE80]">{val}</Text>
                </View>
              ))}
            </AnimatedReanimated.View>
          </View>
          <AnimatedReanimated.View style={plankSuffixStyle}>
            <Text className="font-outfitBold text-[13px] text-[#4ADE80]">s</Text>
          </AnimatedReanimated.View>
        </View>
      </View>

      <View className="absolute top-3 right-10 bg-[#09090B] border border-[#27272A] rounded-lg px-2.5 py-2.5 flex-row items-center gap-2 z-10">
        <View className="relative items-center justify-center w-2 h-2">
          <AnimatedReanimated.View style={[pulseStyle, { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }]} />
          <View className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
        </View>
        <Text className="font-outfitBold text-[9px] tracking-widest text-[#A1A1AA]">
          POSE ENGINE
        </Text>
      </View>

      {/* Skia Engine Canvas replaces SVG */}
      <View className="w-full h-full max-w-[200px] max-h-[200px] mt-4 z-0 items-center justify-center">
        <Canvas style={{ flex: 1, width: '100%', height: '100%' }}>
          {/* Skeleton Bones */}
          <SkiaPath path={bonesPath} color="#3A9E66" style="stroke" strokeWidth={1.5 * scale} strokeCap="round" strokeJoin="round" />
          {/* Joints */}
          <SkiaPath path={jointsPath} color="#94BCA1" style="fill" />
          <SkiaPath path={jointsPath} color="#A7F3D0" style="stroke" strokeWidth={0.5 * scale} />
          {/* Head */}
          <SkiaPath path={headPath} color="#FFFFFF" style="fill" />
        </Canvas>
      </View>
    </View>
  );
};

// ==========================================
// 3.5 Swipeable Feature Card Component
// ==========================================

const AnimatedDot: React.FC<{ index: number; activeTab: number; onPress: () => void; }> = ({ index, activeTab, onPress }) => {
  const isFocused = index === activeTab;
  const dotStyle = useAnimatedStyle(() => ({
    width: withSpring(isFocused ? 20 : 6, { damping: 18, stiffness: 200 }),
    backgroundColor: withTiming(isFocused ? '#3A9E66' : '#3F3F46', { duration: 200 }),
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <AnimatedReanimated.View style={[{ height: 6, borderRadius: 3 }, dotStyle]} />
    </TouchableOpacity>
  );
};

const SwipeableFeatureCard: React.FC<{
  slides: Array<{ title: string; desc: string; icon: React.ReactNode }>;
  activeTab: number;
  setActiveTab: React.Dispatch<React.SetStateAction<number>>;
}> = ({ slides, activeTab, setActiveTab }) => {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const activeTabShared = useSharedValue(activeTab);
  const isAnimating = useSharedValue(false);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    activeTabShared.value = activeTab;
    translateX.value = withTiming(0, { duration: 140 });
    opacity.value = withTiming(1, { duration: 140 }, (finished) => {
      if (finished) isAnimating.value = false;
    });
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isAnimating.value || isDragging.value) return;
      isAnimating.value = true;
      const nextIdx = (activeTabShared.value + 1) % slides.length;
      translateX.value = withTiming(-150, { duration: 180 }, (finished) => {
        if (finished) {
          opacity.value = 0;
          translateX.value = 120;
          runOnJS(setActiveTab)(nextIdx);
        }
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [slides.length, activeTab]);

  const panGesture = Gesture.Pan()
    .onBegin(() => { isDragging.value = true; })
    .onUpdate((e) => {
      if (isAnimating.value) return;
      translateX.value = e.translationX;
      opacity.value = 1 - Math.min(0.5, Math.abs(e.translationX) / 250);
    })
    .onEnd((e) => {
      isDragging.value = false;
      if (isAnimating.value) return;
      const threshold = 35;
      if (e.translationX < -threshold || e.velocityX < -0.35) {
        isAnimating.value = true;
        const nextIdx = (activeTabShared.value + 1) % slides.length;
        translateX.value = withTiming(-150, { duration: 110 }, (finished) => {
          if (finished) {
            opacity.value = 0; translateX.value = 120; runOnJS(setActiveTab)(nextIdx);
          }
        });
      } else if (e.translationX > threshold || e.velocityX > 0.35) {
        isAnimating.value = true;
        const prevIdx = (activeTabShared.value - 1 + slides.length) % slides.length;
        translateX.value = withTiming(150, { duration: 110 }, (finished) => {
          if (finished) {
            opacity.value = 0; translateX.value = -120; runOnJS(setActiveTab)(prevIdx);
          }
        });
      } else {
        translateX.value = withTiming(0, { duration: 140 });
        opacity.value = withTiming(1, { duration: 140 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View className="bg-[#1C1C1E] p-4 rounded-2xl border border-[#27272A] min-h-[130px] flex-col justify-between overflow-hidden">
        <AnimatedReanimated.View style={cardAnimatedStyle} className="mb-2">
          <View className="flex-row items-center gap-3 mb-2">
            <View className="p-1.5 rounded-full" style={{ backgroundColor: 'rgba(58, 158, 102, 0.15)' }}>
              {slides[activeTab].icon}
            </View>
            <Text className="font-outfitBold text-white text-base">
              {slides[activeTab].title}
            </Text>
          </View>
          <Text className="text-[13px] font-outfitReg text-[#A1A1AA] leading-relaxed">
            {slides[activeTab].desc}
          </Text>
        </AnimatedReanimated.View>
        <View className="flex-row items-center gap-1.5 pt-2">
          {slides.map((_, idx) => (
            <AnimatedDot key={idx} index={idx} activeTab={activeTab} onPress={() => {
              if (idx === activeTab || isAnimating.value) return;
              isAnimating.value = true;
              const direction = idx > activeTab ? 'left' : 'right';
              translateX.value = withTiming(direction === 'left' ? -150 : 150, { duration: 110 }, (finished) => {
                if (finished) {
                  opacity.value = 0; translateX.value = direction === 'left' ? 120 : -120; runOnJS(setActiveTab)(idx);
                }
              });
            }} />
          ))}
        </View>
      </View>
    </GestureDetector>
  );
};

// ==========================================
// 4. Onboarding Screen Core Component
// ==========================================

export interface OnboardingScreenProps {
  onNavigateTo: (s: string) => void;
  onClose?: () => void;
  isPreview?: boolean;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onNavigateTo,
  onClose,
  isPreview = false,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const fadeAnim = useSharedValue(0);

  const slides = [
    {
      title: "Smart Rep Counting",
      desc: "AI-powered camera tracking counts your reps and hold times automatically in real time—zero wearables or screen tapping needed.",
      icon: <Sparkles size={18} color="#3A9E66" />
    },
    {
      title: "Detailed Analytics & History",
      desc: "Track workout history, volume charts, personal bests, and daily consistency to measure your continuous progress.",
      icon: <BarChart3 size={18} color="#3A9E66" />
    },
    {
      title: "Leaderboards & Achievements",
      desc: "Compete on global and friends leaderboards, complete quests, maintain streaks, and unlock milestone trophies.",
      icon: <Trophy size={18} color="#3A9E66" />
    }
  ];

  useEffect(() => { fadeAnim.value = withTiming(1, { duration: 600 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  return (
    <View className="flex-1 bg-[#09090B]">
      <StatusBar barStyle="light-content" backgroundColor="#09090B" />
      <PremiumAmbientBackground color="#3A9E66" opacity={0.12} />

      {/* Signature Top Green Ambient Gradient */}
      <LinearGradient
        colors={["rgba(58, 158, 102, 0.35)", "rgba(47, 107, 71, 0.15)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
        pointerEvents="none"
      />

      <SafeAreaView className="flex-1 px-6 pt-2 pb-4 justify-between" edges={["top", "bottom", "left", "right"]}>
        <AnimatedReanimated.View style={[fadeStyle]} className="flex-1 justify-between">
          {/* Top Title */}
          <View className="pt-2">
            <Text className="text-[32px] font-outfitBold tracking-tight text-white leading-[38px]">
              AI workout tracking{"\n"}
              <Text className="text-[#3A9E66]">made effortless.</Text>
            </Text>
          </View>

          {/* Center Dynamic Visuals */}
          <View className="gap-3.5 my-auto">
            <PoseEngineSkeletonBox activeTab={activeTab} />
            <SwipeableFeatureCard slides={slides} activeTab={activeTab} setActiveTab={setActiveTab} />
          </View>

          {/* Bottom Action Slider */}
          <View className="pb-1">
            <SwipeToStartButton
              onComplete={() => {
                if (isPreview && onClose) {
                  onClose();
                } else {
                  onNavigateTo('(auth)/welcome');
                }
              }}
              label={isPreview ? "EXIT PREVIEW" : "SLIDE TO START"}
            />
          </View>
        </AnimatedReanimated.View>
      </SafeAreaView>
    </View>
  );
};

// ==========================================
// 5. Root Onboarding Component
// ==========================================

export default function Onboarding() {
  const router = useRouter();

  useEffect(() => {
    if (storageService.hasSeenOnboarding()) {
      router.replace('/(auth)/welcome');
    }
  }, []);

  const handleNavigate = (screen: string) => {
    storageService.setHasSeenOnboarding(true);
    if (screen === 'home') {
      router.replace('/(tabs)/home');
    } else if (screen === '(auth)/welcome' || screen === 'welcome') {
      router.replace('/(auth)/welcome' as any);
    } else if (screen === '(auth)/signup' || screen === 'signup') {
      router.replace('/(auth)/signup' as any);
    } else {
      router.replace(`/${screen}` as any);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OnboardingScreen onNavigateTo={handleNavigate} />
    </GestureHandlerRootView>
  );
}