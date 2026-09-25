import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { Share, Trophy, X } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import ViewShot from "react-native-view-shot";
import { LEVELS } from "../../store/gamification/achievementStore";
import { useProfileStore } from "../../store/user/profileStore";
import { ModalTopBorder } from "../ui/ModalTopBorder";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

interface LevelUpModalProps {
  isVisible: boolean;
  onClose: () => void;
  level: number;
  username: string;
}

export function LevelUpModal({ isVisible, onClose, level, username }: LevelUpModalProps) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const viewShotRef = useRef<any>(null);

  const levelInfo = LEVELS.find((l) => l.rank === level) || { name: "Paragon" };
  const rankTitle = `Level ${level} • ${levelInfo.name}`;

  const triggerHaptics = () => {
    if (useProfileStore.getState().preferences.haptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 15, stiffness: 120 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 120 }, (finished) => {
        if (finished) {
          runOnJS(triggerHaptics)();
        }
      });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
      scale.value = withTiming(0.8, { duration: 300 });
    }
  }, [isVisible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const handleShare = async () => {
    try {
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, { dialogTitle: "Share your rank!" });
        }
      }
    } catch (e) {
      console.error("Error sharing:", e);
    }
  };

  if (!isVisible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 9999 }, backdropStyle]} className="justify-center items-center">
      {/* Dark Blur Backdrop (Blocks touches) */}
      <View
        style={StyleSheet.absoluteFill}
        className="bg-black/80 backdrop-blur-lg"
        onTouchStart={(e) => e.stopPropagation()}
      />

      <Animated.View style={[animatedStyle, { width: SCREEN_WIDTH * 0.85 }]} className="bg-[#1C1C1E] border border-white/10 rounded-[32px] overflow-hidden p-6 shadow-2xl items-center relative">
        <ModalTopBorder theme="emerald" />
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-white/5 rounded-full border border-white/10"
        >
          <X size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <Text className="text-brand-sage font-outfitMed text-[10px] uppercase tracking-[4px] mt-2 mb-8 opacity-80">
          Rank Promoted
        </Text>

        <View className="relative items-center justify-center mb-8">
          {/* Subtle Glow Behind Badge */}
          <View className="absolute bg-brand-forest/40 w-32 h-32 rounded-full blur-2xl" />
          <View className="bg-gradient-to-b from-[#2F6B47] to-[#121212] p-8 rounded-full border border-brand-forest/50 shadow-lg shadow-brand-forest/20">
            <Trophy size={64} color="#A7C4B5" strokeWidth={1.5} />
          </View>
        </View>

        <Text className="text-white font-outfitBold text-2xl tracking-tight mb-3 text-center">
          {rankTitle}
        </Text>

        <Text className="text-brand-grey font-outfitReg text-sm text-center px-4 leading-relaxed mb-10">
          You've officially entered the elite tier. Your sweat equity is paying off. Keep pushing.
        </Text>

        <TouchableOpacity
          onPress={handleShare}
          className="w-full bg-brand-forest py-4 rounded-2xl flex-row items-center justify-center gap-3 border border-[#3E8B5C] shadow-lg shadow-brand-forest/20"
        >
          <Share size={18} color="#FFFFFF" />
          <Text className="text-white font-outfitBold text-base tracking-wide">
            Share Achievement
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Hidden View for Sharing (9:16 Aspect Ratio) */}
      <View style={{ position: 'absolute', top: -10000, left: -10000 }}>
        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 1.0 }} style={{ width: 1080, height: 1920, backgroundColor: '#0A0A0A' }}>
          <View className="flex-1 justify-center items-center px-12 pb-32 pt-20">
            <Text className="text-brand-sage font-outfitMed text-3xl uppercase tracking-[12px] mb-20">Replix</Text>

            <View className="relative items-center justify-center mb-20">
              <View className="absolute bg-brand-forest/40 w-[600px] h-[600px] rounded-full blur-[100px]" />
              <View className="bg-gradient-to-b from-[#2F6B47] to-[#121212] p-24 rounded-full border border-brand-forest/50 shadow-2xl shadow-brand-forest/20">
                <Trophy size={200} color="#A7C4B5" strokeWidth={1} />
              </View>
            </View>

            <Text className="text-white font-outfitBold text-[90px] tracking-tighter mb-4 text-center leading-none">
              {levelInfo.name}
            </Text>
            <Text className="text-brand-grey font-outfitMed text-[40px] tracking-[8px] mb-24">
              LEVEL {level}
            </Text>

            <View className="bg-white/5 border border-white/10 rounded-[40px] p-12 w-full mb-24">
              <Text className="text-white font-outfitReg text-[42px] text-center leading-[60px]">
                <Text className="font-outfitBold">{username}</Text> just hit {rankTitle} on Replix. Do you have what it takes to beat their score?
              </Text>
            </View>

            <View className="absolute bottom-24 items-center">
              <View className="bg-brand-forest px-10 py-5 rounded-[24px] mb-6">
                <Text className="text-white font-outfitBold text-3xl">Download the App</Text>
              </View>
              <Text className="text-brand-grey font-outfitReg text-2xl tracking-widest">replix.com</Text>
            </View>
          </View>
        </ViewShot>
      </View>
    </Animated.View>
  );
}
