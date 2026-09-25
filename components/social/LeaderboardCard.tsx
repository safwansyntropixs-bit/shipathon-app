import { LeaderboardEntry } from "@/types/leaderboard.types";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { UserAvatar } from "../ui/UserAvatar";

let isNavigatingGlobal = false;

export interface LeaderboardCardProps {
  userRes: LeaderboardEntry;
  isSticky?: boolean;
  onPress?: () => void;
  disableNavigation?: boolean;
}

export const LeaderboardCard = React.memo(({
  userRes,
  isSticky = false,
  onPress,
  disableNavigation = false,
}: LeaderboardCardProps) => {
  const router = useRouter();

  const isGold = userRes.rank === 1;
  const isSilver = userRes.rank === 2;
  const isBronze = userRes.rank === 3;
  const isTop3 = isGold || isSilver || isBronze;

  const handlePress = () => {
    if (disableNavigation) return;
    if (onPress) {
      onPress();
      return;
    }
    if (isNavigatingGlobal) return;
    if (userRes.id && userRes.id !== "guest") {
      isNavigatingGlobal = true;
      if (userRes.isCurrentUser) {
        router.navigate("/(tabs)/profile" as any);
      } else {
        router.push({
          pathname: "/friend-profile",
          params: { id: userRes.id, name: userRes.name },
        });
      }
      setTimeout(() => {
        isNavigatingGlobal = false;
      }, 1000);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disableNavigation && !onPress}
      activeOpacity={disableNavigation && !onPress ? 1 : 0.7}
      className={`rounded-2xl mb-2 overflow-hidden ${isSticky
        ? "shadow-[0_0_20px_rgba(143,174,142,0.3)]"
        : isTop3
          ? "shadow-sm shadow-white/5"
          : ""
        }`}
    >
      <LinearGradient
        colors={
          isSticky
            ? ["#1A241D", "#121A15"]
            : isGold
              ? ["rgba(253,224,71,0.1)", "rgba(245,158,11,0.02)"]
              : isSilver
                ? ["rgba(241,245,249,0.1)", "rgba(148,163,184,0.02)"]
                : isBronze
                  ? ["rgba(253,186,116,0.1)", "rgba(234,88,12,0.02)"]
                  : userRes.isCurrentUser
                    ? ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.03)"]
                    : ["rgba(42,42,42,0.6)", "rgba(22,22,22,0.4)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16 }}
        className={`px-4 py-3 flex-row justify-between items-center border ${isSticky
          ? "border-brand-sage/60"
          : isGold
            ? "border-[#FDE047]/30"
            : isSilver
              ? "border-slate-300/30"
              : isBronze
                ? "border-[#FDBA74]/30"
                : userRes.isCurrentUser
                  ? "border-white/20"
                  : "border-white/5"
          }`}
      >
        <View className="flex-row items-center flex-1 pr-2">
          {/* Rank Badge */}
          <View className="w-8 h-8 mr-3 shadow-md bg-transparent rounded-full overflow-hidden">
            <LinearGradient
              colors={
                isGold
                  ? ["#FDE047", "#F59E0B"]
                  : isSilver
                    ? ["#F1F5F9", "#94A3B8"]
                    : isBronze
                      ? ["#FDBA74", "#EA580C"]
                      : userRes.isCurrentUser
                        ? ["#8FAE8E", "#2F6B47"]
                        : ["#2A2A2A", "#161616"]
              }
              style={{ flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" }}
              className={`${!isTop3 && !userRes.isCurrentUser ? "border border-white/10" : ""}`}
            >
              <Text
                className={`text-[13px] font-outfitBlack ${isTop3 || userRes.isCurrentUser ? "text-[#121212]" : "text-brand-grey"
                  }`}
              >
                #{userRes.rank || "-"}
              </Text>
            </LinearGradient>
          </View>

          <View className="relative">
            <UserAvatar
              avatarUrl={userRes.avatar}
              initials={(userRes.name || "U").substring(0, 2).toUpperCase()}
              className={`w-10 h-10 rounded-full ${userRes.isPremium
                ? "border-[2px] border-[#F0B35C]"
                : isGold
                  ? "border-2 border-[#FDE047]"
                  : isSilver
                    ? "border-2 border-slate-300"
                    : isBronze
                      ? "border-2 border-[#FDBA74]"
                      : userRes.isCurrentUser
                        ? "border-2 border-brand-sage"
                        : "border-2 border-white/10"
                }`}
              size={40}
            />
            {userRes.isPremium && (
              <View className="absolute -bottom-1 -right-1 rounded-full border-[0.5px] border-[#FFF]/50 overflow-hidden shadow-sm shadow-[#FDE047]/40">
                <LinearGradient
                  colors={["#FDE047", "#D97706"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="px-1 py-[0.5px] items-center justify-center"
                >
                  <Text
                    className="text-[6.5px] font-outfitBlack text-[#451A03] tracking-widest uppercase"
                    style={{ textShadowColor: 'rgba(255,255,255,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}
                  >
                    PRO
                  </Text>
                </LinearGradient>
              </View>
            )}
          </View>
          <View className="ml-3 flex-1 justify-center">
            <View className="flex-row items-center gap-1.5">
              <Text
                className={`text-[15px] font-outfitBold ${userRes.isCurrentUser ? "text-brand-charcoal" : "text-brand-charcoal/90"
                  }`}
                numberOfLines={1}
              >
                {userRes.name || "Unknown"}
              </Text>
              {userRes.country_flag ? (
                <Text className="text-sm">{userRes.country_flag}</Text>
              ) : null}
              {userRes.isCurrentUser && (
                <View className="bg-brand-sage px-1.5 py-0.5 rounded-md shadow-sm">
                  <Text className="text-[9px] font-outfitBlack text-brand-bgLight tracking-wide uppercase">
                    YOU
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View className="items-end">
          <Text
            className={`text-[16px] font-outfitBlack ${isGold
              ? "text-[#FDE047]"
              : isSilver
                ? "text-slate-300"
                : isBronze
                  ? "text-[#FDBA74]"
                  : userRes.isCurrentUser
                    ? "text-brand-sage"
                    : "text-brand-charcoal/80"
              }`}
          >
            {(userRes.score || 0).toLocaleString()}
          </Text>
          <Text className="text-[10px] font-outfitMed text-brand-grey mt-[-2px]">XP</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});
