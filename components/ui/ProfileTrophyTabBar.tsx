import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ProfileTrophyTabBarProps {
  activeTab: "achievements" | "trophies" | "leaderboard";
  onTabChange: (tab: any) => void;
  achievementsCount?: number;
  trophyTimeframe?: "weekly" | "monthly";
  onTimeframeChange?: (timeframe: "weekly" | "monthly") => void;
  showTimeframePills?: boolean;
  timeframeMarginBottom?: string;
}

export const ProfileTrophyTabBar: React.FC<ProfileTrophyTabBarProps> = ({
  activeTab,
  onTabChange,
  achievementsCount,
  trophyTimeframe = "weekly",
  onTimeframeChange,
  showTimeframePills = true,
  timeframeMarginBottom = "mb-4",
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const underlineTranslateX = useSharedValue(0);

  const isAchievements = activeTab === "achievements";

  useEffect(() => {
    if (containerWidth > 0) {
      const targetX = isAchievements ? 0 : containerWidth / 2;
      underlineTranslateX.value = withTiming(targetX, {
        duration: 220,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    }
  }, [isAchievements, containerWidth, underlineTranslateX]);

  const animatedUnderlineStyle = useAnimatedStyle(() => {
    if (containerWidth === 0) return { opacity: 0 };
    return {
      opacity: 1,
      width: containerWidth / 2,
      transform: [{ translateX: underlineTranslateX.value }],
    };
  });

  return (
    <View className="w-full">
      {/* Tab Switcher Header */}
      <View
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width > 0) setContainerWidth(width);
        }}
        className="w-full mb-3 relative"
      >
        <View className="w-full flex-row items-center pb-2">
          {/* Tab 1: Achievements */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onTabChange("achievements")}
            className="flex-1 items-center justify-center py-1.5"
          >
            <Text
              className={`text-[12px] font-outfitBold uppercase tracking-wider ${
                isAchievements ? "text-white" : "text-white/40"
              }`}
            >
              Achievements{" "}
              {achievementsCount !== undefined && achievementsCount > 0
                ? `(${achievementsCount})`
                : ""}
            </Text>
          </TouchableOpacity>

          {/* Tab 2: Trophies */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              onTabChange(activeTab === "leaderboard" ? "leaderboard" : "trophies")
            }
            className="flex-1 items-center justify-center py-1.5"
          >
            <Text
              className={`text-[12px] font-outfitBold uppercase tracking-wider ${
                !isAchievements ? "text-white" : "text-white/40"
              }`}
            >
              Trophies
            </Text>
          </TouchableOpacity>
        </View>

        {/* Animated Green Underline Indicator */}
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: 0,
              height: 1.5,
              borderRadius: 9999,
              backgroundColor: "#3A9E66",
              shadowColor: "#3A9E66",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.8,
              shadowRadius: 4,
              elevation: 4,
            },
            animatedUnderlineStyle,
          ]}
        />
      </View>

      {/* Weekly / Monthly Sub-Toggle (visible when Trophies is active) */}
      {!isAchievements && showTimeframePills && onTimeframeChange && (
        <View className={`flex-row justify-center ${timeframeMarginBottom}`}>
          <View className="flex-row items-center bg-white/[0.06] rounded-xl p-0.5 border border-white/5">
            <TouchableOpacity
              onPress={() => onTimeframeChange("weekly")}
              className={`px-3.5 py-1 rounded-lg ${
                trophyTimeframe === "weekly" ? "bg-[#3A9E66]" : ""
              }`}
            >
              <Text
                className={`text-[10px] font-outfitBold uppercase tracking-wider ${
                  trophyTimeframe === "weekly" ? "text-white" : "text-white/50"
                }`}
              >
                Weekly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onTimeframeChange("monthly")}
              className={`px-3.5 py-1 rounded-lg ${
                trophyTimeframe === "monthly" ? "bg-[#3A9E66]" : ""
              }`}
            >
              <Text
                className={`text-[10px] font-outfitBold uppercase tracking-wider ${
                  trophyTimeframe === "monthly" ? "text-white" : "text-white/50"
                }`}
              >
                Monthly
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
