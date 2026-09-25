import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LeaderboardEntry } from "@/types/leaderboard.types";
import { UserAvatar } from "../ui/UserAvatar";

export interface LeaderboardTop3CardsProps {
  entries: LeaderboardEntry[];
  onProfilePress?: (userId: string, name: string) => void;
  disableNavigation?: boolean;
  className?: string;
}

const EMPTY_ENTRY: LeaderboardEntry = {
  rank: 0,
  id: "",
  name: "-",
  avatar: null,
  score: 0,
  country_flag: null,
};

export const LeaderboardTop3Cards = React.memo(({
  entries,
  onProfilePress,
  disableNavigation = false,
  className = "",
}: LeaderboardTop3CardsProps) => {
  // Normalize top 3 into first (rank 1), second (rank 2), third (rank 3)
  const { firstPlace, secondPlace, thirdPlace } = useMemo(() => {
    if (!entries || entries.length === 0) {
      return {
        firstPlace: { ...EMPTY_ENTRY, rank: 1 },
        secondPlace: { ...EMPTY_ENTRY, rank: 2 },
        thirdPlace: { ...EMPTY_ENTRY, rank: 3 },
      };
    }

    // Check if input is already in [2nd, 1st, 3rd] podium order
    if (entries[0]?.rank === 2 && entries[1]?.rank === 1) {
      return {
        secondPlace: entries[0],
        firstPlace: entries[1],
        thirdPlace: entries[2] || { ...EMPTY_ENTRY, rank: 3 },
      };
    }

    // Otherwise find by rank or fall back by index
    const first: LeaderboardEntry = entries.find((e) => e.rank === 1) || entries[0] || { ...EMPTY_ENTRY, rank: 1 };
    const second: LeaderboardEntry = entries.find((e) => e.rank === 2) || entries[1] || { ...EMPTY_ENTRY, rank: 2 };
    const third: LeaderboardEntry = entries.find((e) => e.rank === 3) || entries[2] || { ...EMPTY_ENTRY, rank: 3 };

    return {
      firstPlace: first,
      secondPlace: second,
      thirdPlace: third,
    };
  }, [entries]);

  const handlePress = (entry: LeaderboardEntry) => {
    if (disableNavigation || !onProfilePress) return;
    if (entry.id && entry.name !== "-" && entry.id !== "guest") {
      onProfilePress(entry.id, entry.name);
    }
  };

  return (
    <View className={`flex-row justify-between items-end h-[220px] gap-2 ${className}`}>
      {/* 2nd Place (Silver) */}
      {secondPlace?.id && secondPlace.name !== "-" ? (
        <TouchableOpacity
          onPress={() => handlePress(secondPlace)}
          disabled={disableNavigation || !onProfilePress}
          className="flex-1 items-center justify-end h-full"
          activeOpacity={disableNavigation ? 1 : 0.8}
        >
          <View className="items-center w-full z-10">
            <View className="relative items-center mb-[-24px] z-20">
              <View className="absolute top-[-30px] z-40 drop-shadow-lg items-center justify-center">
                <Image
                  source={require("../../assets/rankings_badge/rank2_icon.png")}
                  style={{ width: 40, height: 40 }}
                  resizeMode="contain"
                />
              </View>
              <UserAvatar
                avatarUrl={secondPlace.avatar}
                initials={(secondPlace.name || "-").substring(0, 2).toUpperCase()}
                className="w-14 h-14 rounded-full border-[3px] border-slate-300 z-20 bg-brand-bgLight"
                size={56}
              />
            </View>

            <LinearGradient
              colors={["rgba(148,163,184,0.15)", "rgba(148,163,184,0.02)"]}
              style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
              className="w-full items-center pt-8 pb-4 px-1 border-t border-x border-slate-400/20"
            >
              <Text
                className="text-[12px] font-outfitBold text-slate-200 mb-1 w-full text-center px-1"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {secondPlace.name}
              </Text>
              {secondPlace.country_flag ? (
                <View className="mb-1.5">
                  <Text className="text-lg">{secondPlace.country_flag}</Text>
                </View>
              ) : null}
              <Text className="text-[13px] font-outfitBlack text-slate-300">
                {(secondPlace.score || 0).toLocaleString()}
              </Text>
              <Text className="text-[9px] font-outfitMed text-slate-400 mt-[-2px]">XP</Text>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      ) : (
        <View className="flex-1" />
      )}

      {/* 1st Place (Gold) */}
      {firstPlace ? (
        <TouchableOpacity
          onPress={() => handlePress(firstPlace)}
          disabled={disableNavigation || !onProfilePress}
          className="flex-[1.2] items-center justify-end h-full"
          activeOpacity={disableNavigation ? 1 : 0.8}
        >
          <View className="items-center w-full z-20">
            <View className="relative items-center mb-[-32px] z-30">
              <View className="absolute top-[-40px] z-40 drop-shadow-lg items-center justify-center">
                <Image
                  source={require("../../assets/rankings_badge/rank1_icon.png")}
                  style={{ width: 48, height: 48 }}
                  resizeMode="contain"
                />
              </View>
              <View className="rounded-full p-[2px] bg-amber-400/20 z-30">
                <UserAvatar
                  avatarUrl={firstPlace.avatar}
                  initials={(firstPlace.name || "-").substring(0, 2).toUpperCase()}
                  className="w-[72px] h-[72px] rounded-full border-[3px] border-[#FDE047] bg-brand-bgLight"
                  size={72}
                />
              </View>
            </View>

            <LinearGradient
              colors={["rgba(251,191,36,0.25)", "rgba(217,119,6,0.05)"]}
              style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
              className="w-full items-center pt-10 pb-6 px-1 border-t-2 border-x-2 border-[#FDE047]/40"
            >
              <Text
                className="text-[14px] font-outfitBlack text-[#FDE047] mb-1 w-full text-center px-1"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {firstPlace.name}
              </Text>
              {firstPlace.country_flag ? (
                <View className="mb-1.5">
                  <Text className="text-xl">{firstPlace.country_flag}</Text>
                </View>
              ) : null}
              <Text className="text-[15px] font-outfitBlack text-amber-300">
                {(firstPlace.score || 0).toLocaleString()}
              </Text>
              <Text className="text-[10px] font-outfitMed text-amber-300/70 mt-[-2px]">XP</Text>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      ) : (
        <View className="flex-[1.2]" />
      )}

      {/* 3rd Place (Bronze) */}
      {thirdPlace?.id && thirdPlace.name !== "-" ? (
        <TouchableOpacity
          onPress={() => handlePress(thirdPlace)}
          disabled={disableNavigation || !onProfilePress}
          className="flex-1 items-center justify-end h-full"
          activeOpacity={disableNavigation ? 1 : 0.8}
        >
          <View className="items-center w-full z-10">
            <View className="relative items-center mb-[-20px] z-20">
              <View className="absolute top-[-26px] z-40 drop-shadow-lg items-center justify-center">
                <Image
                  source={require("../../assets/rankings_badge/rank3_icon.png")}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>
              <UserAvatar
                avatarUrl={thirdPlace.avatar}
                initials={(thirdPlace.name || "-").substring(0, 2).toUpperCase()}
                className="w-12 h-12 rounded-full border-[3px] border-[#FDBA74] z-20 bg-brand-bgLight"
                size={48}
              />
            </View>

            <LinearGradient
              colors={["rgba(234,88,12,0.15)", "rgba(154,52,18,0.02)"]}
              style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
              className="w-full items-center pt-7 pb-1 px-1 border-t border-x border-orange-500/30"
            >
              <Text
                className="text-[12px] font-outfitBold text-[#FDBA74] mb-1 w-full text-center px-1"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {thirdPlace.name}
              </Text>
              {thirdPlace.country_flag ? (
                <View className="mb-1.5">
                  <Text className="text-lg">{thirdPlace.country_flag}</Text>
                </View>
              ) : null}
              <Text className="text-[13px] font-outfitBlack text-orange-200">
                {(thirdPlace.score || 0).toLocaleString()}
              </Text>
              <Text className="text-[9px] font-outfitMed text-orange-200/60 mt-[-2px]">XP</Text>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      ) : (
        <View className="flex-1" />
      )}
    </View>
  );
});
