import { useProGuard } from "@/hooks/useProGuard";
import { LeaderboardEntry } from "@/types/leaderboard.types";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { ArrowLeft, ArrowRight, Share2, X } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import ViewShot from "react-native-view-shot";
import { PremiumAmbientBackground } from "../layout/PremiumAmbientBackground";
import { LeaderboardCard } from "../social/LeaderboardCard";
import { LeaderboardTop3Cards } from "../social/LeaderboardTop3Cards";
import { PremiumButton } from "../ui/PremiumButton";
import { LockedFeatureModal } from "./LockedFeatureModal";
import { formatUserErrorMessage } from "@/utils/errorUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface CelebrationProgressStats {
  workouts: number;
  totalXP: number;
  activeDays: number;
  pushupReps: number;
  squatReps: number;
  plankTimeSec: number;
  accuracy: number;
}

export interface CelebrationModalData {
  type: "weekly_friends" | "weekly_global" | "monthly_global";
  heading: string;
  periodLabel: string;
  top3: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry;
  stats: CelebrationProgressStats;
  username: string;
  avatarUrl?: string;
  level: number;
  isPro?: boolean;
}

interface CelebrationModalProps {
  visible: boolean;
  onClose: () => void;
  data: CelebrationModalData;
}

export function CelebrationModal({ visible, onClose, data }: CelebrationModalProps) {
  const [currentView, setCurrentView] = useState<"rankings" | "progress">("rankings");
  const [isSharing, setIsSharing] = useState(false);
  const progressCardRef = useRef<ViewShot>(null);

  const {
    isPro,
    executeIfPro,
    isProModalVisible,
    closeProModal,
    handleUpgradePress,
    modalConfig,
  } = useProGuard();

  const isUserPro = useMemo(() => {
    if (typeof data?.isPro === "boolean") return data.isPro;
    return Boolean(isPro);
  }, [data?.isPro, isPro]);

  const isMonthly = useMemo(() => {
    return data?.type === "monthly_global" || (data?.type && data.type.startsWith("monthly"));
  }, [data?.type]);

  // Safe fallback for top3 in case of legacy persisted state or empty data
  const top3 = useMemo(() => {
    if (Array.isArray(data?.top3) && data.top3.length > 0) {
      return data.top3;
    }
    const legacy = (data as any)?.globalTop3 || (data as any)?.friendsTop3;
    if (Array.isArray(legacy) && legacy.length > 0) {
      return legacy.map((item: any, idx: number) => ({
        rank: item.rank || idx + 1,
        id: item.id || `rank-${idx + 1}`,
        name: item.name || "Athlete",
        avatar: item.avatar || null,
        score: item.score || 0,
        country_flag: item.country_flag,
        isCurrentUser: Boolean(item.isCurrentUser),
      }));
    }
    return [];
  }, [data]);

  // Safe fallback for currentUserEntry with Pro golden border & badge entitlement
  const currentUserEntry = useMemo<LeaderboardEntry>(() => {
    const baseEntry = data?.currentUserEntry || {
      rank: (data as any)?.userGlobalRank || (data as any)?.userFriendsRank || 9999,
      id: "me",
      name: data?.username || "You",
      avatar: data?.avatarUrl || null,
      score: (data as any)?.userGlobalScore || (data as any)?.userFriendsScore || data?.stats?.totalXP || 0,
      isCurrentUser: true,
      level: data?.level || 1,
      country_flag: null,
    };

    return {
      ...baseEntry,
      isPremium: Boolean(isUserPro || baseEntry.isPremium),
    };
  }, [data, isUserPro]);

  // Safe fallback for stats
  const stats = useMemo(() => {
    return (
      data?.stats || {
        workouts: 0,
        totalXP: 0,
        activeDays: 0,
        pushupReps: 0,
        squatReps: 0,
        plankTimeSec: 0,
        accuracy: 0,
      }
    );
  }, [data?.stats]);

  // Check if current user is present in the top 3 cards
  const isUserInTop3 = useMemo(() => {
    if (typeof currentUserEntry.rank === "number" && currentUserEntry.rank >= 1 && currentUserEntry.rank <= 3) {
      return true;
    }
    if (!top3 || top3.length === 0) return false;
    return top3.some(
      (entry) =>
        entry.isCurrentUser ||
        (currentUserEntry.id && entry.id === currentUserEntry.id)
    );
  }, [top3, currentUserEntry]);

  // Trophy image for top 3 placement
  const trophyImage = useMemo(() => {
    if (currentUserEntry.rank === 1) {
      return require("../../assets/rankings_badge/rank1_icon.png");
    }
    if (currentUserEntry.rank === 2) {
      return require("../../assets/rankings_badge/rank2_icon.png");
    }
    if (currentUserEntry.rank === 3) {
      return require("../../assets/rankings_badge/rank3_icon.png");
    }
    return null;
  }, [currentUserEntry.rank]);

  const trophyTitle = useMemo(() => {
    if (currentUserEntry.rank === 1) return "1st Place Gold Trophy";
    if (currentUserEntry.rank === 2) return "2nd Place Silver Trophy";
    if (currentUserEntry.rank === 3) return "3rd Place Bronze Trophy";
    return "";
  }, [currentUserEntry.rank]);

  // Rank-based styling for Trophy Achieved card
  const trophyTheme = useMemo(() => {
    if (currentUserEntry.rank === 1) {
      return {
        border: "border-[#FDE047]/40",
        shadow: "shadow-[#FDE047]/10",
        text: "text-[#FDE047]",
      };
    }
    if (currentUserEntry.rank === 2) {
      return {
        border: "border-slate-300/40",
        shadow: "shadow-slate-300/10",
        text: "text-slate-300",
      };
    }
    if (currentUserEntry.rank === 3) {
      return {
        border: "border-[#FDBA74]/40",
        shadow: "shadow-[#FDBA74]/10",
        text: "text-[#FDBA74]",
      };
    }
    return {
      border: "border-white/10",
      shadow: "shadow-transparent",
      text: "text-white/60",
    };
  }, [currentUserEntry.rank]);

  // Motivational gap copy to reach 1st position
  const motivation = useMemo(() => {
    const userRank = currentUserEntry?.rank || 9999;
    const firstScore = top3.find((e) => e.rank === 1)?.score || top3[0]?.score || 0;
    const userScore = currentUserEntry?.score || 0;

    if (userRank === 1) {
      return {
        text: "👑 Outstanding! You secured 1st position. Reigning Champion this round!",
        color: "#FDE047",
      };
    }

    if (firstScore > userScore) {
      const gap = Math.max(1, firstScore - userScore);
      if (gap <= 100) {
        return {
          text: `🔥 Heartbeat away! Just ${gap.toLocaleString()} XP separated you from 1st position!`,
          color: "#3A9E66",
        };
      }
      return {
        text: `⚡ Only ${gap.toLocaleString()} XP away from claiming 1st position! Keep that momentum going!`,
        color: "#3A9E66",
      };
    }

    return {
      text: "⚡ Incredible effort! Every workout brings you closer to 1st position.",
      color: "#3A9E66",
    };
  }, [currentUserEntry, top3]);

  // Share user's progress card (Instantaneous capture from dedicated export view)
  const handleShareProgress = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      if (progressCardRef.current?.capture) {
        const uri = await progressCardRef.current.capture();
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: `Replix Performance - ${data?.username || "Athlete"}`,
          });
        }
      }
    } catch (error: any) {
      console.error("Failed to share progress card", error);
      Alert.alert("Export Failed", formatUserErrorMessage(error, "Could not export or share progress card."));
    } finally {
      setIsSharing(false);
    }
  };

  const formatPlankTime = (sec: number) => {
    if (!sec || sec <= 0) return "0s";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  if (!visible || !data) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#050505]/95 justify-center items-center px-4 relative">
        <PremiumAmbientBackground color="#3A9E66" opacity={0.2} />

        {/* Signature Top Green Ambient Gradient Glow (Matching App Screens) */}
        <LinearGradient
          colors={["rgba(58,158,102,0.38)", "rgba(58,158,102,0.12)", "rgba(58,158,102,0.02)", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 400,
            zIndex: 0,
          }}
          pointerEvents="none"
        />

        {/* ========================================================================= */}
        {/* HIDDEN OFF-SCREEN EXPORT VIEWSHOT (Always pre-rendered for instant share) */}
        {/* ========================================================================= */}
        <View
          style={{
            position: "absolute",
            left: -9999,
            top: 0,
            width: Math.min(SCREEN_WIDTH - 32, 420),
            opacity: 1,
            pointerEvents: "none",
          }}
          pointerEvents="none"
        >
          <ViewShot
            ref={progressCardRef}
            options={{ format: "png", quality: 1 }}
            style={{
              width: "100%",
              backgroundColor: "#050505",
              borderRadius: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: "100%",
                alignItems: "center",
                paddingHorizontal: 18,
                paddingVertical: 20,
              }}
            >
              {/* Export-Only Top Ambient Green Gradient Glow */}
              <LinearGradient
                colors={["rgba(58,158,102,0.38)", "rgba(58,158,102,0.12)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 260,
                }}
                pointerEvents="none"
              />

              {/* 1) Heading & Date Range */}
              <View className="items-center mb-4">
                <View className="bg-white/10 px-3.5 py-1 rounded-full border border-white/15 mb-2">
                  <Text className="text-[10px] font-outfitBlack uppercase tracking-[0.2em] text-[#3A9E66]">
                    {data.periodLabel}
                  </Text>
                </View>
                <Text className="text-xl font-outfitBlack uppercase tracking-wider text-white text-center">
                  {data.heading}
                </Text>
                <Text className="text-[10px] font-outfitBold uppercase tracking-widest text-white/40 mt-1">
                  Athlete Performance Report
                </Text>
              </View>

              {/* 2) Trophy Achieved Showcase (if gained trophy in Top 3) */}
              {trophyImage && (
                <View
                  className={`w-full bg-[#141414]/90 border ${trophyTheme.border} rounded-2xl p-3 mb-3 flex-row items-center justify-between shadow-md ${trophyTheme.shadow}`}
                >
                  <View className="flex-row items-center flex-1">
                    <Image
                      source={trophyImage}
                      style={{ width: 36, height: 36 }}
                      resizeMode="contain"
                    />
                    <View className="ml-3 flex-1">
                      <Text
                        className={`text-[9px] font-outfitBold ${trophyTheme.text} uppercase tracking-widest`}
                      >
                        Trophy Achieved
                      </Text>
                      <Text className="text-sm font-outfitBlack text-white">
                        {trophyTitle}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 3) User Standing (LeaderboardCard - Shows Gold border & PRO badge if user is Pro) */}
              <View className="w-full mb-3">
                <LeaderboardCard userRes={currentUserEntry} isSticky disableNavigation />
              </View>

              {/* 4) Unified Core Stats Card (Grid with subtle inner dividers) */}
              <View className="w-full bg-[#141414]/95 rounded-2xl border border-white/10 overflow-hidden mb-1">
                {/* Row 1: Earned XP & Workouts */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 items-center py-4 px-2 border-r border-white/5">
                    <Text className="text-2xl font-outfitBlack text-white">
                      {stats.totalXP.toLocaleString()}
                    </Text>
                    <Text className="text-[9px] font-outfitBold text-white/40 uppercase tracking-wider mt-0.5">
                      Earned XP
                    </Text>
                  </View>
                  <View className="flex-1 items-center py-4 px-2">
                    <Text className="text-2xl font-outfitBlack text-white">
                      {stats.workouts}
                    </Text>
                    <Text className="text-[9px] font-outfitBold text-white/40 uppercase tracking-wider mt-0.5">
                      Workouts
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View className="w-full h-[1px] bg-white/5" />

                {/* Row 2: Push-ups & Squats */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 items-center py-3.5 px-2 border-r border-white/5">
                    <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mb-1">
                      Push-ups
                    </Text>
                    <Text className="text-xl font-outfitBlack text-white">
                      {stats.pushupReps.toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-1 items-center py-3.5 px-2">
                    <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mb-1">
                      Squats
                    </Text>
                    <Text className="text-xl font-outfitBlack text-white">
                      {stats.squatReps.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View className="w-full h-[1px] bg-white/5" />

                {/* Row 3: Plank Time & Active Days */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 items-center py-3.5 px-2 border-r border-white/5">
                    <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mb-1">
                      Plank Time
                    </Text>
                    <Text className="text-xl font-outfitBlack text-white">
                      {formatPlankTime(stats.plankTimeSec)}
                    </Text>
                  </View>
                  <View className="flex-1 items-center py-3.5 px-2">
                    <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mb-1">
                      Active Days
                    </Text>
                    <Text className="text-xl font-outfitBlack text-white">
                      {stats.activeDays} Days
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View className="w-full h-[1px] bg-white/5" />

                {/* Row 4: Average AI Form Precision */}
                <View className="w-full py-3.5 px-4 flex-row items-center justify-between">
                  <Text className="text-xs font-outfitBold text-white/80">
                    Average AI Form Precision
                  </Text>
                  <Text className="text-sm font-outfitBlack text-[#3A9E66]">
                    {stats.accuracy}%
                  </Text>
                </View>
              </View>

              {/* Export-Only CTA: Visible ONLY on shared image */}
              <View className="items-center mt-3 pt-2.5 border-t border-white/10 w-full">
                <Text className="text-[10px] font-outfitBold uppercase tracking-[0.14em] text-[#3A9E66] text-center italic">
                  Download Replix from Play Store to track workouts & compete with friends
                </Text>
              </View>
            </View>
          </ViewShot>
        </View>

        {/* Close Button */}
        <TouchableOpacity
          onPress={onClose}
          style={{
            top: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : 52,
            right: 20,
          }}
          className="absolute z-40 w-8 h-8 rounded-full bg-white/10 items-center justify-center border border-white/15"
          activeOpacity={0.8}
        >
          <X size={16} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.scrollWrapper}
        >
          <View className="w-full max-w-md items-center">
            {/* ========================================================================= */}
            {/* VIEW 1: RANKINGS & POSITION CARDS / MONTHLY LOCKED TEASER                 */}
            {/* ========================================================================= */}
            {currentView === "rankings" && (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="w-full items-center">
                {/* 1) Heading & Date Range */}
                <View className="items-center mb-6">
                  <View className="bg-white/10 px-3.5 py-1 rounded-full border border-white/15 mb-2">
                    <Text className="text-[10px] font-outfitBlack uppercase tracking-[0.2em] text-[#3A9E66]">
                      {data.periodLabel}
                    </Text>
                  </View>
                  <Text className="text-xl font-outfitBlack uppercase tracking-wider text-white text-center">
                    {data.heading}
                  </Text>
                </View>

                {/* MONTHLY RECAP GUARD: If monthly & !isPro -> hide podium and show teaser */}
                {isMonthly && !isPro ? (
                  <View className="w-full items-center">
                    <View className="w-full bg-[#141414]/90 border border-[#F0B35C]/30 rounded-3xl p-6 items-center my-3 shadow-xl shadow-[#F0B35C]/10">
                      <Text className="text-xl font-outfitBlack text-white text-center mb-2 tracking-tight">
                        The Month has ended!
                      </Text>
                      <Text className="text-xs font-outfitReg text-brand-grey text-center leading-relaxed mb-6 px-2">
                        Upgrade to Pro to reveal monthly global results, and your monthly progress.
                      </Text>
                      <PremiumButton
                        title="Upgrade to Pro"
                        onPress={() =>
                          executeIfPro(() => { }, {
                            title: "Monthly Recap",
                            description:
                              "Upgrade to Replix Pro to reveal your final Global Rank and monthly performance breakdown.",
                          })
                        }
                        variant="gold"
                        size="lg"
                        className="w-full rounded-2xl"
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    {/* 2) Leaderboard Podium Cards */}
                    <View className="w-full mb-3 px-1">
                      <LeaderboardTop3Cards entries={top3} disableNavigation />
                    </View>

                    {/* 3) Current User Position (if not in top 3 positions) */}
                    {!isUserInTop3 && currentUserEntry && (
                      <View className="w-full mt-2 mb-2">
                        <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40 mb-1.5 px-1">
                          Your Position
                        </Text>
                        <LeaderboardCard userRes={currentUserEntry} isSticky disableNavigation />
                      </View>
                    )}

                    {/* 4) Softened Motivational Block */}
                    <View className="w-full bg-[#141414]/90 border border-white/5 rounded-2xl p-4 items-center my-3 shadow-sm">
                      <Text
                        className="text-xs font-outfitBold text-center leading-5"
                        style={{ color: motivation.color }}
                      >
                        {motivation.text}
                      </Text>
                    </View>

                    {/* 5) Navigation Button to Progress View */}
                    <PremiumButton
                      title={data.type.startsWith("weekly") ? "My Weekly Progress" : "My Monthly Progress"}
                      onPress={() => setCurrentView("progress")}
                      variant="green"
                      size="lg"
                      icon={<ArrowRight size={18} color="#052e16" strokeWidth={2.5} />}
                      iconPosition="right"
                      className="w-full rounded-2xl mt-2"
                    />
                  </>
                )}
              </Animated.View>
            )}

            {/* ========================================================================= */}
            {/* VIEW 2: USER'S PROGRESS (UNIFIED GRID CARD)                               */}
            {/* ========================================================================= */}
            {currentView === "progress" && (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} className="w-full items-center">
                {/* Header with Back button */}
                <View className="w-full flex-row items-center justify-between mb-3">
                  <TouchableOpacity
                    onPress={() => setCurrentView("rankings")}
                    className="py-1.5 px-3 bg-white/10 rounded-full border border-white/15 flex-row items-center gap-1.5"
                    activeOpacity={0.8}
                  >
                    <ArrowLeft size={13} color="#FFFFFF" strokeWidth={2.5} />
                    <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white">
                      Rankings
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* In-App Visible Progress Content */}
                <View className="w-full items-center">
                  {/* 1) Heading & Date Range */}
                  <View className="items-center mb-4">
                    <View className="bg-white/10 px-3.5 py-1 rounded-full border border-white/15 mb-2">
                      <Text className="text-[10px] font-outfitBlack uppercase tracking-[0.2em] text-[#3A9E66]">
                        {data.periodLabel}
                      </Text>
                    </View>
                    <Text className="text-xl font-outfitBlack uppercase tracking-wider text-white text-center">
                      {data.heading}
                    </Text>
                    <Text className="text-[10px] font-outfitBold uppercase tracking-widest text-white/40 mt-1">
                      Athlete Performance Report
                    </Text>
                  </View>

                  {/* 2) Trophy Achieved Showcase (if gained trophy in Top 3) */}
                  {trophyImage && (
                    <View
                      className={`w-full bg-[#141414]/90 border ${trophyTheme.border} rounded-2xl p-3 mb-3 flex-row items-center justify-between shadow-md ${trophyTheme.shadow}`}
                    >
                      <View className="flex-row items-center flex-1">
                        <Image
                          source={trophyImage}
                          style={{ width: 36, height: 36 }}
                          resizeMode="contain"
                        />
                        <View className="ml-3 flex-1">
                          <Text
                            className={`text-[9px] font-outfitBold ${trophyTheme.text} uppercase tracking-widest`}
                          >
                            Trophy Achieved
                          </Text>
                          <Text className="text-sm font-outfitBlack text-white">
                            {trophyTitle}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* 3) User Standing (LeaderboardCard - Shows Gold border & PRO badge if user is Pro) */}
                  <View className="w-full mb-3">
                    <LeaderboardCard userRes={currentUserEntry} isSticky disableNavigation />
                  </View>

                  {/* 4) Unified Core Stats Card */}
                  <View className="w-full bg-[#141414]/80 rounded-2xl border border-white/10 overflow-hidden mb-1">
                    {/* Row 1: Earned XP & Workouts */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 items-center py-4 px-2 border-r border-white/5">
                        <Text className="text-2xl font-outfitBlack text-white">
                          {stats.totalXP.toLocaleString()}
                        </Text>
                        <Text className="text-[9px] font-outfitBold text-white/40 uppercase tracking-wider mt-0.5">
                          Earned XP
                        </Text>
                      </View>
                      <View className="flex-1 items-center py-4 px-2">
                        <Text className="text-2xl font-outfitBlack text-white">
                          {stats.workouts}
                        </Text>
                        <Text className="text-[9px] font-outfitBold text-white/40 uppercase tracking-wider mt-0.5">
                          Workouts
                        </Text>
                      </View>
                    </View>

                    {/* Divider */}
                    <View className="w-full h-[1px] bg-white/5" />

                    {/* Row 2: Push-ups & Squats */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 items-center py-3.5 px-2 border-r border-white/5">
                        <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mb-1">
                          Push-ups
                        </Text>
                        <Text className="text-xl font-outfitBlack text-white">
                          {stats.pushupReps.toLocaleString()}
                        </Text>
                      </View>
                      <View className="flex-1 items-center py-3.5 px-2">
                        <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mb-1">
                          Squats
                        </Text>
                        <Text className="text-xl font-outfitBlack text-white">
                          {stats.squatReps.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {/* Divider */}
                    <View className="w-full h-[1px] bg-white/5" />

                    {/* Row 3: Plank Time & Active Days */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 items-center py-3.5 px-2 border-r border-white/5">
                        <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mb-1">
                          Plank Time
                        </Text>
                        <Text className="text-xl font-outfitBlack text-white">
                          {formatPlankTime(stats.plankTimeSec)}
                        </Text>

                      </View>
                      <View className="flex-1 items-center py-3.5 px-2">
                        <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mb-1">
                          Active Days
                        </Text>
                        <Text className="text-xl font-outfitBlack text-white">
                          {stats.activeDays} Days
                        </Text>

                      </View>
                    </View>

                    {/* Divider */}
                    <View className="w-full h-[1px] bg-white/5" />

                    {/* Row 4: Average AI Form Precision */}
                    <View className="w-full py-3.5 px-4 flex-row items-center justify-between">
                      <Text className="text-xs font-outfitBold text-white/80">
                        Average AI Form Precision
                      </Text>
                      <Text className="text-sm font-outfitBlack text-[#3A9E66]">
                        {stats.accuracy}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bottom Action: Share Progress */}
                <PremiumButton
                  title="Share Progress"
                  onPress={handleShareProgress}
                  loading={isSharing}
                  disabled={isSharing}
                  variant="green"
                  size="lg"
                  icon={<Share2 size={18} color="#052e16" strokeWidth={2.5} />}
                  iconPosition="left"
                  className="w-full rounded-2xl mt-3"
                />
              </Animated.View>
            )}
          </View>
        </ScrollView>

        {/* Global Pro Paywall Modal */}
        <LockedFeatureModal
          visible={isProModalVisible}
          onClose={closeProModal}
          onUpgradePress={handleUpgradePress}
          title={modalConfig.title || "Unlock Replix Pro"}
          description={
            modalConfig.description ||
            "Upgrade to Pro to access in-depth analytics, monthly global recaps, and advanced performance intel."
          }
          buttonText={modalConfig.buttonText || "Upgrade to Pro"}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollWrapper: {
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 40 : 58,
    paddingBottom: 20,
  },
});
