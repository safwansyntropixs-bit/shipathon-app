import { ProfileTrophyTabBar } from "@/components/ui/ProfileTrophyTabBar";
import { useIsFocused } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Lock,
  Pencil,
  Settings
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, {
  FadeInDown
} from "react-native-reanimated";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { LEVELS } from "../../constants/gamification";
import { TROPHY_DETAILS } from "../../constants/trophies";
import { useProGuard } from "../../hooks/useProGuard";
import { useStreakStore } from "../../store/gamification/streakStore";
import { useTrophyStore } from "../../store/gamification/trophyStore";
import { useAuthStore } from "../../store/user/authStore";
import { useProfileStore } from "./../../store/user/profileStore";

const ALL_TROPHIES = Object.values(TROPHY_DETAILS);

export default function Profile() {
  const { isPro } = useProGuard();
  const storeUser = useAuthStore((s) => s.user);
  const router = useRouter();
  const storeProfile = useProfileStore((s) => s.profile);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const storeLongestStreak = useStreakStore((s) => s.longestStreak);
  const loadStreakData = useStreakStore((s) => s.loadStreakData);

  const storeUnlockedTrophies = useTrophyStore((s) => s.unlockedTrophies);
  const loadTrophies = useTrophyStore((s) => s.loadTrophies);

  // UX Fix: Cache values to prevent UI flash on logout
  const userRef = React.useRef(storeUser);
  const profileRef = React.useRef(storeProfile);
  const streakRef = React.useRef(storeLongestStreak);
  const trophiesRef = React.useRef(storeUnlockedTrophies);

  if (storeUser) {
    userRef.current = storeUser;
    profileRef.current = storeProfile;
    streakRef.current = storeLongestStreak;
    trophiesRef.current = storeUnlockedTrophies;
  }

  const user = storeUser || userRef.current;
  const profile = storeProfile || profileRef.current;
  const longestStreak = storeUser ? storeLongestStreak : streakRef.current;
  const unlockedTrophies = storeUser ? storeUnlockedTrophies : trophiesRef.current;

  const [activeTrophyTab, setActiveTrophyTab] = useState<"achievements" | "trophies">("achievements");
  const [trophyTimeframe, setTrophyTimeframe] = useState<"weekly" | "monthly">("weekly");

  const isNavigatingRef = React.useRef(false);
  const isFocused = useIsFocused();

  useFocusEffect(
    React.useCallback(() => {
      isNavigatingRef.current = false;
      return () => {
        isNavigatingRef.current = true;
      };
    }, [])
  );

  const safeNavigate = React.useCallback((path: any) => {
    if (isNavigatingRef.current || !isFocused) return;
    isNavigatingRef.current = true;
    router.navigate(path);
  }, [router, isFocused]);

  // Read actual trophies from store safely
  const trophyCounts = useProfileStore((s) => s.trophyCounts);
  const currentTrophyCounts = trophyTimeframe === "monthly"
    ? (trophyCounts?.monthly || { rank1: 0, rank2: 0, rank3: 0 })
    : (trophyCounts?.weekly || { rank1: 0, rank2: 0, rank3: 0 });
  const safeUnlockedTrophies = Array.isArray(unlockedTrophies) ? unlockedTrophies : [];

  const leaderboardTrophies = [
    { id: 'rank1', name: '1st Place', image: require('../../assets/rankings_badge/rank1_icon.png'), count: currentTrophyCounts.rank1 ?? 0 },
    { id: 'rank2', name: '2nd Place', image: require('../../assets/rankings_badge/rank2_icon.png'), count: currentTrophyCounts.rank2 ?? 0 },
    { id: 'rank3', name: '3rd Place', image: require('../../assets/rankings_badge/rank3_icon.png'), count: currentTrophyCounts.rank3 ?? 0 }
  ];

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
      loadStreakData(user.id);
      loadTrophies(user.id);
    }
  }, [user?.id, fetchProfile, loadStreakData, loadTrophies]);

  const rawName = profile?.username || user?.email?.split('@')[0] || "Athlete";
  const nameParts = rawName.trim().split(" ");
  let initials = "AT";
  if (nameParts.length >= 2) {
    initials = (nameParts[0][0] + nameParts[1][0]).toUpperCase();
  } else if (nameParts.length === 1 && nameParts[0].length > 0) {
    initials = nameParts[0].substring(0, 2).toUpperCase();
  }
  const memberSince = (profile?.created_at || user?.created_at)
    ? new Date((profile?.created_at || user?.created_at)!).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })
    : "Member";

  const userLevelNum = profile?.level || 1;
  const currentLevelObj = LEVELS.find((l) => l.rank === userLevelNum) || LEVELS[0];
  const currentXP = profile?.xp || 0;

  return (
    <View className="flex-1 bg-transparent">
      {/* Signature Ambient Green Glow matching other tabs */}
      <PremiumAmbientBackground />

      {/* Fluid Responsive Scroll View */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 110,
        }}
        className="flex-1"
      >
        {/* ======================================================== */}
        {/* USER PROFILE IDENTITY (Seamless, Open, Unboxed Layout)  */}
        {/* ======================================================== */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(400)}
          className="flex-row items-start justify-between mb-5 mt-1"
        >
          {/* Left Column: Name, Location, Tagline, Actions */}
          <View className="flex-1 pr-3">
            <Text className="text-[24px] font-outfitBlack text-white tracking-tight uppercase leading-tight" numberOfLines={2}>
              {rawName}
            </Text>

            {/* Location / Flag & Member date */}
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <Text className="text-xs font-outfitMed text-white/50">
                Joined {memberSince} {profile?.country_flag}
              </Text>
            </View>

            {/* Action Buttons Row */}
            <View className="flex-row items-center gap-1 mt-3.5">
              <TouchableOpacity
                onPress={() => safeNavigate("/edit-profile")}
                disabled={!isFocused}
                className="px-3.5 py-1.5 bg-[#161618] border border-white/10 rounded-full flex-row items-center gap-1.5 active:opacity-60"
                style={{
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <Pencil size={11} color="#A1A1AA" />
                <Text className="text-[10.5px] font-outfitBold uppercase tracking-wider text-white">
                  Edit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => safeNavigate("/settings")}
                disabled={!isFocused}
                className="px-3.5 py-1.5 bg-[#161618] border border-white/10 rounded-full flex-row items-center gap-1.5 active:opacity-60"
                style={{
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <Settings size={11} color="#A1A1AA" />
                <Text className="text-[10.5px] font-outfitBold uppercase tracking-wider text-white">
                  Settings
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Column: Large Circular Avatar */}
          <View className="relative items-center justify-center">
            <View
              className="rounded-full p-[3px]"
              style={{
                backgroundColor: isPro ? "rgba(240, 179, 92, 0.4)" : "rgba(255, 255, 255, 0.08)"
              }}
            >
              <UserAvatar
                avatarUrl={profile?.avatar_url}
                initials={initials}
                size={82}
                className={isPro ? "border-2 border-[#F0B35C]" : "border border-white/20"}
              />
            </View>

            {isPro && (
              <View className="absolute -bottom-1 rounded-full overflow-hidden shadow-md shadow-[#FDE047]/30">
                <LinearGradient
                  colors={["#FDE047", "#D97706"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="px-2 py-0.5 flex-row items-center justify-center gap-0.5"
                >
                  <Text className="text-[7.5px] font-outfitBold text-[#451A03] tracking-wider uppercase">
                    PRO
                  </Text>
                </LinearGradient>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ======================================================== */}
        {/* 2 THEMED METRIC TILES                                    */}
        {/* ======================================================== */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          className="flex-row gap-2.5 mb-4"
        >
          {/* Max Streak Tile */}
          <View className="flex-1 bg-[#121212]/50 border border-[#3A9E66]/20 rounded-2xl py-3 px-2 items-center justify-center">
            <View className="flex-row items-center gap-1">
              <Text className="text-[20px] font-outfitBlack text-white tracking-tight">
                {longestStreak ?? profile?.longest_streak ?? 0}
              </Text>
            </View>
            <Text className="text-[9px] font-outfitBold uppercase tracking-wider text-white/50 mt-0.5 text-center">
              Max Streak
            </Text>
          </View>

          {/* Total Workouts Tile */}
          <View className="flex-1 bg-[#121212]/50 border border-[#3A9E66]/20 rounded-2xl py-3 px-2 items-center justify-center">
            <View className="flex-row items-center gap-1">
              <Text className="text-[20px] font-outfitBlack text-white tracking-tight">
                {(profile?.total_workouts || 0).toLocaleString()}
              </Text>
            </View>
            <Text className="text-[9px] font-outfitBold uppercase tracking-wider text-white/50 mt-0.5 text-center">
              Workouts
            </Text>
          </View>
        </Animated.View>

        {/* ======================================================== */}
        {/* ACHIEVEMENTS & TROPHIES TABS (ProfileTrophyTabBar)       */}
        {/* ======================================================== */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <ProfileTrophyTabBar
            activeTab={activeTrophyTab}
            onTabChange={setActiveTrophyTab}
            trophyTimeframe={trophyTimeframe}
            onTimeframeChange={setTrophyTimeframe}
            timeframeMarginBottom="mb-5"
          />

          {/* Grid Content */}
          {activeTrophyTab === "achievements" ? (
            <View className="flex-row flex-wrap justify-between pt-2">
              {ALL_TROPHIES.map((trophy) => {
                const isUnlocked = safeUnlockedTrophies.some((t) => t.id === trophy.id);
                return (
                  <TouchableOpacity
                    key={trophy.id}
                    className="w-[30%] items-center mb-6"
                    onPress={() => safeNavigate(`/achievement/${trophy.id}`)}
                    disabled={!isFocused}
                    activeOpacity={0.7}
                  >
                    {/* Badge Image Container without background circles */}
                    <View
                      className="w-16 h-16 items-center justify-center relative mb-2"
                      style={
                        isUnlocked
                          ? {
                            shadowColor: trophy.accentColor || "#3A9E66",
                            shadowOpacity: 0.65,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 2 },
                            elevation: 8,
                          }
                          : {}
                      }
                    >
                      <Image
                        source={trophy.image}
                        style={{ width: 56, height: 56, resizeMode: "contain" }}
                        className={isUnlocked ? "" : "opacity-25 grayscale"}
                      />

                      {!isUnlocked && (
                        <View className="absolute z-10 bg-[#121214]/90 p-1.5 rounded-full border border-white/10 shadow-sm">
                          <Lock size={10} color="#A1A1AA" />
                        </View>
                      )}
                    </View>

                    {/* Badge Name */}
                    <Text
                      className={`text-[10.5px] font-outfitBold text-center uppercase tracking-wider leading-tight ${isUnlocked ? "text-white" : "text-white/30"
                        }`}
                      numberOfLines={2}
                    >
                      {trophy.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="py-2">

              {/* Row 1: 1st and 2nd Place */}
              <View className="flex-row justify-center gap-14 mb-6">
                {leaderboardTrophies.slice(0, 2).map((trophy) => {
                  const isUnlocked = trophy.count > 0;
                  return (
                    <View key={trophy.id} className="items-center">
                      <View
                        className="w-16 h-16 items-center justify-center relative mb-2"
                        style={
                          isUnlocked
                            ? {
                              shadowColor: "#F0B35C",
                              shadowOpacity: 0.65,
                              shadowRadius: 12,
                              shadowOffset: { width: 0, height: 2 },
                              elevation: 8,
                            }
                            : {}
                        }
                      >
                        <Image
                          source={trophy.image}
                          style={{ width: 56, height: 56, resizeMode: "contain" }}
                          className={isUnlocked ? "" : "opacity-25 grayscale"}
                        />
                        {!isUnlocked && (
                          <View className="absolute z-10 bg-[#121214]/90 p-1.5 rounded-full border border-white/10 shadow-sm">
                            <Lock size={10} color="#A1A1AA" />
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Text
                          className={`text-[10.5px] font-outfitBold uppercase tracking-wider ${isUnlocked ? "text-white" : "text-white/30"
                            }`}
                        >
                          {trophy.name}
                        </Text>
                        {trophy.count > 1 && (
                          <View className="bg-[#F0B35C]/20 px-1 rounded">
                            <Text className="text-[8px] font-outfitBlack text-[#F0B35C]">x{trophy.count}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Row 2: 3rd Place */}
              {leaderboardTrophies[2] && (() => {
                const trophy = leaderboardTrophies[2];
                const isUnlocked = trophy.count > 0;
                return (
                  <View className="flex-row justify-center mb-2">
                    <View className="items-center">
                      <View
                        className="w-16 h-16 items-center justify-center relative mb-2"
                        style={
                          isUnlocked
                            ? {
                              shadowColor: "#F0B35C",
                              shadowOpacity: 0.65,
                              shadowRadius: 12,
                              shadowOffset: { width: 0, height: 2 },
                              elevation: 8,
                            }
                            : {}
                        }
                      >
                        <Image
                          source={trophy.image}
                          style={{ width: 56, height: 56, resizeMode: "contain" }}
                          className={isUnlocked ? "" : "opacity-25 grayscale"}
                        />
                        {!isUnlocked && (
                          <View className="absolute z-10 bg-[#121214]/90 p-1.5 rounded-full border border-white/10 shadow-sm">
                            <Lock size={10} color="#A1A1AA" />
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Text
                          className={`text-[10.5px] font-outfitBold uppercase tracking-wider ${isUnlocked ? "text-white" : "text-white/30"
                            }`}
                        >
                          {trophy.name}
                        </Text>
                        {trophy.count > 1 && (
                          <View className="bg-[#F0B35C]/20 px-1 rounded">
                            <Text className="text-[8px] font-outfitBlack text-[#F0B35C]">x{trophy.count}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}
        </Animated.View>

        {/* ======================================================== */}
        {/* PRO STATUS / UPGRADE CARDS (Multi-Layer Frosted Glass)   */}
        {/* ======================================================== */}
        {!isPro ? (
          /* Free Tier: Frosted Glass Upgrade Card */
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mt-2 mb-3">
            <TouchableOpacity
              onPress={() => safeNavigate("/premium")}
              disabled={!isFocused}
              activeOpacity={0.9}
              className="w-full"
            >
              <View
                className="w-full rounded-[20px] overflow-hidden border border-white/[0.14] relative"
                style={{
                  backgroundColor: "rgba(10, 20, 14, 0.45)",
                  minHeight: 96,
                  shadowColor: "#3A9E66",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.2,
                  shadowRadius: 16,
                  elevation: 5,
                }}
              >
                {/* 1. Real Frosted Glass Blur Layer */}
                <BlurView
                  intensity={40}
                  tint="dark"
                  experimentalBlurMethod="dimezisBlurView"
                  style={StyleSheet.absoluteFill}
                />

                {/* 2. Ambient Emerald Aurora Gradient */}
                <LinearGradient
                  colors={[
                    "rgba(58, 158, 102, 0.22)",
                    "rgba(30, 80, 50, 0.08)",
                    "rgba(8, 14, 10, 0.65)",
                  ]}
                  start={{ x: 0.9, y: 0 }}
                  end={{ x: 0.1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                {/* 3. Top Specular Glass Reflection Edge */}
                <LinearGradient
                  colors={[
                    "rgba(255, 255, 255, 0.16)",
                    "rgba(255, 255, 255, 0.02)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 0.4 }}
                  style={StyleSheet.absoluteFill}
                />

                {/* Card Content (Centered Vertically with Spacious Padding) */}
                <View className="px-5 py-5 flex-row items-center justify-between">
                  {/* Left Column: Headline & Actual Short Pro Value Prop */}
                  <View className="flex-1 pr-3.5 justify-center">
                    <Text className="text-[16px] font-outfitBold text-white tracking-tight leading-tight">
                      Unlock Full Potential
                    </Text>
                    <Text className="text-[12px] font-outfitMed text-white/60 mt-1 leading-[16px]">
                      Unlimited history, deep analytics & competitor intel.
                    </Text>
                  </View>

                  {/* Right Column: Minimalist High-Contrast Satin CTA Pill */}
                  <View
                    className="bg-white px-4 py-2.5 rounded-full items-center justify-center"
                    style={{
                      shadowColor: "#3A9E66",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.35,
                      shadowRadius: 6,
                      elevation: 3,
                    }}
                  >
                    <Text className="text-[11px] font-outfitBold tracking-wider text-[#090E0A] uppercase">
                      Upgrade
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          /* Pro Tier: Active Member Card (Minimalist Luxury Frosted Glass, No Buttons) */
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mt-2 mb-3">
            <View
              className="w-full rounded-[20px] overflow-hidden border border-[#F0B35C]/20 relative"
              style={{
                backgroundColor: "rgba(22, 17, 10, 0.45)",
                minHeight: 96,
                shadowColor: "#F0B35C",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 5,
              }}
            >
              {/* 1. Real Frosted Glass Blur Layer */}
              <BlurView
                intensity={40}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />

              {/* 2. Ambient Luxury Gold Aurora Gradient */}
              <LinearGradient
                colors={[
                  "rgba(240, 179, 92, 0.20)",
                  "rgba(180, 83, 9, 0.08)",
                  "rgba(18, 14, 8, 0.65)",
                ]}
                start={{ x: 0.9, y: 0 }}
                end={{ x: 0.1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* 3. Top Specular Glass Reflection Edge */}
              <LinearGradient
                colors={[
                  "rgba(255, 255, 255, 0.16)",
                  "rgba(255, 255, 255, 0.02)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 0.4 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Card Content (Centered Vertically with Spacious Padding) */}
              <View className="px-5 py-5 justify-center">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-[#F0B35C]" />
                  <Text className="text-[9px] font-outfitBlack text-[#F0B35C] uppercase tracking-widest">
                    PRO ATHLETE
                  </Text>
                </View>
                <Text className="text-[12px] font-outfitMed text-white/60 mt-1 leading-[16px]">
                  Full access to unlimited workout history, deep analytics & competitor intel.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}