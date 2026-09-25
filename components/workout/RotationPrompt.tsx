import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { RotateCw, Smartphone, Timer } from "lucide-react-native";

export const RotationPrompt = ({
  requiredOrientation,
  hasCountdownFinishedOnce,
  sessionGlobalSeconds,
}: {
  requiredOrientation: "landscape" | "portrait";
  hasCountdownFinishedOnce: boolean;
  sessionGlobalSeconds: number;
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [requiredOrientation]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: requiredOrientation === "landscape" 
      ? ["0deg", "90deg"] 
      : ["90deg", "0deg"],
  });

  return (
    <View className="absolute inset-0 bg-black/90 backdrop-blur-md items-center justify-center z-50 px-8">
      <View className="items-center justify-center bg-[#1C1C1E] p-10 rounded-3xl border border-white/10 shadow-2xl w-full max-w-sm">
        <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 32 }}>
          <Smartphone size={80} color="#8FAE8E" strokeWidth={1.5} />
        </Animated.View>
        <Text className="text-white font-outfitBold text-2xl mb-3 text-center">
          Rotate Device
        </Text>
        <Text className="text-[#A1A1AA] font-outfitReg text-sm text-center leading-relaxed mb-6">
          {hasCountdownFinishedOnce ? (
            <Text>Tracking suspended, but your clock is still ticking. Fix quickly to save your Speed Multiplier!</Text>
          ) : (
            <Text>
              Please physically rotate your phone to <Text className="text-brand-sage font-outfitBold">{requiredOrientation}</Text> orientation to continue.
            </Text>
          )}
        </Text>

        {hasCountdownFinishedOnce && (
          <View className="bg-red-500/20 px-4 py-2 rounded-xl mb-6 flex-row items-center gap-2 border border-red-500/30">
            <Timer size={16} color="#EF4444" />
            <Text className="text-red-400 font-outfitBold text-lg">
              {Math.floor(sessionGlobalSeconds / 60)
                .toString()
                .padStart(2, "0")}
              :{(sessionGlobalSeconds % 60).toString().padStart(2, "0")}
            </Text>
          </View>
        )}

        <View className="flex-row items-center justify-center gap-2 bg-white/5 px-4 py-2 rounded-full">
          <RotateCw size={14} color="#8FAE8E" />
          <Text className="text-brand-sage font-outfitMed text-xs uppercase tracking-widest">Awaiting Rotation</Text>
        </View>
      </View>
    </View>
  );
};
