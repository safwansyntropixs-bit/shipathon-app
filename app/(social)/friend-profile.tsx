import { RippleRing, SkeletonBlock } from "@/components/loaders/SkeletonLoader";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { LockedFeatureModal } from "@/components/modals/LockedFeatureModal";
import { ModalTopBorder } from "@/components/ui/ModalTopBorder";
import { ProfileTrophyTabBar } from "@/components/ui/ProfileTrophyTabBar";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { BADGES, getRankTheme, LEVELS, TROPHY_DETAILS } from "@/constants/gamification";
import { useProGuard } from "@/hooks/useProGuard";
import { FriendFullDetails, friendService } from "@/services/social/friendService";
import { leaderboardService } from "@/services/social/leaderboardService";
import { useStreakStore } from "@/store/gamification/streakStore";
import { useFriendStore } from "@/store/social/friendStore";
import { useLeaderboardStore } from "@/store/social/leaderboardStore";
import { useAuthStore } from "@/store/user/authStore";
import { formatTime } from "@/utils/analyticsFormatters";
import { formatUserErrorMessage } from "@/utils/errorUtils";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import {
  ArrowLeft,
  Award,
  Clock,
  Crown,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

export default function FriendProfileScreen() {
  const router = useRouter();
  const { id: friendId, name: initialName, isFriend } = useLocalSearchParams<{ id: string; name?: string; isFriend?: string }>();
  const user = useAuthStore((s) => s.user);

  const {
    isPro,
    isProModalVisible,
    closeProModal,
    executeIfPro,
    handleUpgradePress,
    modalConfig,
  } = useProGuard();

  const currentStreak = useStreakStore((state) => state.currentStreak);
  const friends = useFriendStore((s) => s.friends);
  const outgoingRequests = useFriendStore((s) => s.outgoingRequests);
  const incomingRequests = useFriendStore((s) => s.incomingRequests);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const removeFriend = useFriendStore((s) => s.removeFriend);

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<FriendFullDetails | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [requestSending, setRequestSending] = useState(false);
  const [justSentRequest, setJustSentRequest] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [friendWeeklyXP, setFriendWeeklyXP] = useState<number | null>(null);
  const [myWeeklyXP, setMyWeeklyXP] = useState<number | null>(null);
  const [activeTrophyTab, setActiveTrophyTab] = useState<"achievements" | "leaderboard">("achievements");
  const [trophyTimeframe, setTrophyTimeframe] = useState<"weekly" | "monthly">("weekly");

  const currentUserId = user?.id ?? "";
  const isSelf = currentUserId === friendId;
  const hasAccess = isSelf || isPro;

  const isAlreadyFriend =
    isFriend === "true" ||
    friends.some((f) => f.id === friendId);

  const outgoingReq = outgoingRequests.find(
    (r) => r.receiver_id === friendId
  );
  const incomingReq = incomingRequests.find(
    (r) => r.sender_id === friendId
  );

  const isRequestSent = !!outgoingReq || justSentRequest;
  const isIncomingRequest = !!incomingReq;

  const handleAddFriend = async () => {
    if (!currentUserId || !friendId || requestSending) return;
    setRequestSending(true);
    try {
      await sendRequest(currentUserId, friendId as string);
      setJustSentRequest(true);
    } catch (err) {
      Alert.alert("Error", formatUserErrorMessage(err, "Could not send friend request. Please try again."));
    } finally {
      setRequestSending(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUserId || !incomingReq || requestSending) return;
    setRequestSending(true);
    try {
      await acceptRequest(incomingReq.id, friendId as string, currentUserId);
    } catch (err) {
      Alert.alert("Error", formatUserErrorMessage(err, "Could not accept friend request. Please try again."));
    } finally {
      setRequestSending(false);
    }
  };

  useEffect(() => {
    if (!friendId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [res, myRank, friendRank] = await Promise.all([
          friendService.getFriendFullDetails(friendId as string, hasAccess),
          currentUserId ? leaderboardService.fetchCurrentUserRank("weekly", currentUserId) : Promise.resolve(null),
          leaderboardService.fetchCurrentUserRank("weekly", friendId as string)
        ]);
        if (isMounted) {
          setDetails(res);
          setMyWeeklyXP(myRank?.score ?? 0);
          setFriendWeeklyXP(friendRank?.score ?? 0);
        }
      } catch (err) {
        console.error("Error loading friend profile details:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [friendId, hasAccess, currentUserId]);

  const handleRemoveFriend = async () => {
    if (!friendId || !currentUserId) return;
    setIsRemoving(true);
    try {
      await removeFriend(currentUserId, friendId as string);
      useLeaderboardStore.getState().loadLeaderboard(currentUserId);
      router.back();
    } catch (err) {
      Alert.alert("Error", formatUserErrorMessage(err, "Could not remove friend. Please try again."));
      setIsRemoving(false);
      setShowRemoveModal(false);
    }
  };

  const xpDifference = (friendWeeklyXP !== null && myWeeklyXP !== null)
    ? myWeeklyXP - friendWeeklyXP
    : 0;

  const renderFriendBadge = () => {
    if (friendWeeklyXP === null || myWeeklyXP === null || xpDifference === 0) {
      return (
        <View className="px-2.5 py-1 bg-white/[0.06] rounded-full flex-row items-center gap-1.5">
          <UserCheck size={11} color="#3A9E66" />
          <Text className="text-[10px] font-outfitBold text-white uppercase tracking-wider">Friends</Text>
        </View>
      );
    }

    if (xpDifference > 0) {
      return (
        <View className="px-2.5 py-1 bg-[#3A9E66]/15 rounded-full flex-row items-center gap-1.5">
          <Text className="text-[10px] font-outfitBold text-[#3A9E66] uppercase tracking-wider">
            +{xpDifference.toLocaleString()} XP Ahead
          </Text>
        </View>
      );
    } else {
      return (
        <View className="px-2.5 py-1 bg-[#EF4444]/15 rounded-full flex-row items-center gap-1.5">
          <Text className="text-[10px] font-outfitBold text-[#EF4444] uppercase tracking-wider">
            -{Math.abs(xpDifference).toLocaleString()} XP Behind
          </Text>
        </View>
      );
    }
  };

  const userLevelNum = details?.stats.level || 1;
  const currentLevelObj = LEVELS.find((l) => l.rank === userLevelNum) || LEVELS[0];
  const nextLevelObj = LEVELS.find((l) => l.rank === userLevelNum + 1) || null;

  const currentXP = details?.stats.totalXP || 0;
  const minXpCurrent = currentLevelObj.minXp;
  const maxXpNext = nextLevelObj ? nextLevelObj.minXp : currentXP || 1;
  const xpRange = Math.max(maxXpNext - minXpCurrent, 1);
  const xpProgress = nextLevelObj
    ? Math.min(Math.max((currentXP - minXpCurrent) / xpRange, 0), 1)
    : 1;

  const rankTheme = getRankTheme(userLevelNum);
  const rankImage = BADGES[currentLevelObj.name];

  const formattedJoinDate = details?.profile.created_at
    ? new Date(details.profile.created_at).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })
    : null;

  const trophyCounts = details?.trophyCounts;
  const currentTrophyCounts = trophyTimeframe === 'monthly'
    ? (trophyCounts?.monthly || { rank1: 0, rank2: 0, rank3: 0 })
    : (trophyCounts?.weekly || { rank1: 0, rank2: 0, rank3: 0 });

  const leaderboardTrophies = [
    { id: 'rank1', name: '1st Place', image: require('../../assets/rankings_badge/rank1_icon.png'), count: currentTrophyCounts.rank1 ?? 0 },
    { id: 'rank2', name: '2nd Place', image: require('../../assets/rankings_badge/rank2_icon.png'), count: currentTrophyCounts.rank2 ?? 0 },
    { id: 'rank3', name: '3rd Place', image: require('../../assets/rankings_badge/rank3_icon.png'), count: currentTrophyCounts.rank3 ?? 0 }
  ];

  return (
    <View className="flex-1 justify-end items-center relative">
      {/* Background Backdrop Tap to Close */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => router.back()}
        className="absolute inset-0 z-0"
      />

      {/* Non-Scrolling Bottom Sheet Modal Container (Dynamic Height) */}
      <View className="w-full z-10 relative shadow-2xl">
        <View className="w-full bg-[#141417] rounded-t-[32px] px-5 pt-4 pb-8 overflow-hidden shadow-2xl relative">
          <ModalTopBorder theme="emerald" />
          {/* Glow background inside modal */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, zIndex: 0 }} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="vibrantGreenGlow" cx="50%" cy="0%" rx="60%" ry="60%">
                  <Stop offset="0%" stopColor="#3A9E66" stopOpacity="0.35" />
                  <Stop offset="60%" stopColor="#3A9E66" stopOpacity="0.08" />
                  <Stop offset="100%" stopColor="#141417" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#vibrantGreenGlow)" />
            </Svg>
          </View>

          {/* Top Bar: Back & Actions */}
          <View className="flex-row items-center justify-between w-full mb-3 z-20">
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-8 h-8 items-center justify-center rounded-full bg-white/[0.06]"
            >
              <ArrowLeft size={17} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              {isSelf ? (
                <View className="px-3 py-1 bg-white/[0.08] rounded-full">
                  <Text className="text-[10px] font-outfitBold text-white uppercase tracking-widest">You</Text>
                </View>
              ) : isAlreadyFriend ? (
                <>
                  {renderFriendBadge()}
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setShowRemoveModal(true);
                    }}
                    disabled={isRemoving}
                    activeOpacity={0.75}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="w-8 h-8 items-center justify-center rounded-full bg-[#18181B] border border-white/10 active:border-red-500/40 active:bg-red-500/15 shadow-xs"
                  >
                    <UserMinus size={14} color="#F87171" strokeWidth={2.2} />
                  </TouchableOpacity>
                </>
              ) : isRequestSent ? (
                <View className="px-3 py-1 bg-[#F0B35C]/15 rounded-full flex-row items-center gap-1.5">
                  <Clock size={11} color="#F0B35C" />
                  <Text className="text-[10px] font-outfitBold text-[#F0B35C] uppercase tracking-wider">Pending</Text>
                </View>
              ) : isIncomingRequest ? (
                <TouchableOpacity
                  onPress={handleAcceptRequest}
                  disabled={requestSending}
                  className="px-3.5 py-1 bg-[#3A9E66] rounded-full items-center justify-center flex-row shadow-sm gap-1.5"
                  activeOpacity={0.8}
                >
                  {requestSending ? (
                    <View className="flex-row items-center justify-center h-[14px] w-[40px]">
                      <RippleRing delay={0} color="#FFFFFF" />
                    </View>
                  ) : (
                    <>
                      <UserPlus size={12} color="#FFFFFF" />
                      <Text className="text-[10px] font-outfitBold text-white uppercase tracking-wider">Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleAddFriend}
                  disabled={requestSending}
                  className="px-3.5 py-1 bg-[#3A9E66]/20 border border-[#3A9E66]/40 rounded-full items-center justify-center flex-row shadow-sm gap-1.5"
                  activeOpacity={0.8}
                >
                  {requestSending ? (
                    <View className="flex-row items-center justify-center h-[14px] w-[50px]">
                      <RippleRing delay={0} color="#3A9E66" />
                    </View>
                  ) : (
                    <>
                      <UserPlus size={12} color="#3A9E66" />
                      <Text className="text-[10px] font-outfitBold text-[#3A9E66] uppercase tracking-wider">Add Friend</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Main Content Layout (Dynamic Height) */}
          {loading ? (
            <View className="z-20 w-full py-1 gap-2.5">
              <View className="flex-row items-center gap-3 mb-2">
                <SkeletonBlock width={50} height={50} borderRadius={25} />
                <View className="flex-1">
                  <SkeletonBlock width={120} height={18} borderRadius={6} className="mb-1.5" />
                  <SkeletonBlock width={80} height={10} borderRadius={4} />
                </View>
              </View>
              <SkeletonBlock width="100%" height={44} borderRadius={16} />
              <SkeletonBlock width="100%" height={48} borderRadius={16} />
              <SkeletonBlock width="100%" height={110} borderRadius={16} />
            </View>
          ) : (
            <View className="z-20 w-full">

              {/* ======================================================== */}
              {/* SECTION 1: CONSOLIDATED HEADER & VANITY METRICS          */}
              {/* ======================================================== */}
              <View>
                {/* Profile Identity & Rank Row */}
                <View className="flex-row items-center justify-between mb-3.5">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="rounded-full p-[2px]"
                      style={{ backgroundColor: `${rankTheme.color}30` }}
                    >
                      <UserAvatar
                        avatarUrl={details?.profile.avatar_url}
                        initials={(details?.profile.username || initialName || "U").substring(0, 2).toUpperCase()}
                        className="w-[50px] h-[50px] rounded-full"
                        size={50}
                      />
                    </View>

                    <View>
                      <View className="flex-row items-center">
                        <Text className="text-lg font-outfitBold text-white tracking-tight" numberOfLines={1}>
                          {details?.profile.username || initialName || "Athlete"}
                        </Text>
                        {details?.profile.country_flag && (
                          <Text className="text-sm ml-1.5">{details.profile.country_flag}</Text>
                        )}
                      </View>
                      {formattedJoinDate ? (
                        <Text className="text-[11px] font-outfitMed text-white/40 mt-0.5">
                          Joined {formattedJoinDate}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Rank Badge */}
                  <View className="items-end">
                    <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-xl">
                      <Text className={`font-outfitBold text-${details?.stats.globalRank === 1 ? "[#FDE047]" : "[#F0B35C]"}`}>
                        #{details?.stats.globalRank || "-"}
                      </Text>
                    </View>
                    <Text className="text-[9px] font-outfitMed text-white/40 uppercase tracking-wider mt-0.5">
                      🌍 Monthly Rank
                    </Text>
                  </View>
                </View>

                {/* Seamless Level Progress Bar */}
                <View className="bg-white/[0.03] rounded-2xl p-3 mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: `${rankTheme.color}20` }}>
                        {rankImage ? (
                          <Image source={rankImage} style={{ width: 14, height: 14, resizeMode: 'contain' }} />
                        ) : (
                          <Shield size={10} color={rankTheme.color} />
                        )}
                      </View>
                      <Text className="text-xs font-outfitBold text-white/90">
                        {currentXP.toLocaleString()} <Text className="text-[10px] text-white/40 font-outfitMed">/ {maxXpNext.toLocaleString()} XP</Text>
                      </Text>
                    </View>

                    <Text className="text-[10px] font-outfitBold" style={{ color: rankTheme.color }}>
                      {Math.round(xpProgress * 100)}%
                    </Text>
                  </View>

                  <View className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${xpProgress * 100}%`, backgroundColor: rankTheme.color }}
                    />
                  </View>
                </View>

                {/* Compact Achievements / Trophies Row */}
                <View className="bg-white/[0.03] rounded-2xl p-3 mb-2.5">
                  <ProfileTrophyTabBar
                    activeTab={activeTrophyTab}
                    onTabChange={setActiveTrophyTab}
                    achievementsCount={details?.achievements?.length}
                    trophyTimeframe={trophyTimeframe}
                    onTimeframeChange={setTrophyTimeframe}
                    timeframeMarginBottom="mb-2.5"
                  />

                  {activeTrophyTab === 'achievements' ? (
                    (!details?.achievements || details.achievements.length === 0) ? (
                      <View className="flex-row items-center justify-center gap-1.5 py-2">
                        <Award size={13} color="#71717A" />
                        <Text className="text-xs font-outfitReg text-white/40">No achievements unlocked yet</Text>
                      </View>
                    ) : (
                      <View className="flex-row flex-wrap items-center gap-2 py-0.5">
                        {details.achievements.slice(0, 6).map((item) => {
                          const trophy = TROPHY_DETAILS[item.achievement_id];
                          if (!trophy) return null;
                          return (
                            <View
                              key={item.achievement_id}
                              className="w-9 h-9 rounded-xl items-center justify-center"
                              style={{ backgroundColor: `${trophy.accentColor}15` }}
                            >
                              <Image source={trophy.image} style={{ width: '70%', height: '70%', resizeMode: 'contain' }} />
                            </View>
                          );
                        })}
                      </View>
                    )
                  ) : (
                    <View className="pt-0.5">
                      {/* Trophies Row */}
                      <View className="flex-row justify-around py-0.5">
                        {leaderboardTrophies.map((trophy) => {
                          const isUnlocked = trophy.count > 0;
                          return (
                            <View key={trophy.id} className="flex-row items-center gap-1.5">
                              <Image
                                source={trophy.image}
                                style={{ width: 22, height: 22, resizeMode: 'contain' }}
                                className={isUnlocked ? "" : "opacity-25 grayscale"}
                              />
                              <Text className={`text-xs font-outfitBold ${isUnlocked ? 'text-white' : 'text-white/30'}`}>
                                {trophy.name} {trophy.count > 1 ? `x${trophy.count}` : ''}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* ======================================================== */}
              {/* SECTION 2: PERFORMANCE INTEL (Pro Gated with Teaser)     */}
              {/* ======================================================== */}
              <View className="relative">
                <View className="flex-row items-center justify-between mb-1.5 px-0.5">
                  <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40">
                    Performance Intel
                  </Text>
                </View>

                {/* Performance Container */}
                <View className="relative rounded-2xl overflow-hidden bg-white/[0.03] p-3">
                  {/* Streak & Volume Row */}
                  <View className="flex-row justify-between mb-2.5 pb-2.5 border-b border-white/[0.05]">
                    <View className="items-center flex-1 border-r border-white/[0.05]">
                      <View className="relative items-center justify-center">
                        <View className="flex-row items-center gap-1">
                          <Text className="text-base font-outfitBold text-white">
                            {hasAccess ? (isSelf ? (currentStreak ?? details?.stats.streak ?? 0) : (details?.stats.streak ?? 0)) : "14"} <Text className="text-[10px] text-white/50 font-outfitMed">Days</Text>
                          </Text>
                        </View>
                        {!hasAccess && (
                          <BlurView
                            intensity={20}
                            tint="dark"
                            experimentalBlurMethod="dimezisBlurView"
                            className="absolute -inset-1 rounded-md"
                          />
                        )}
                      </View>
                      <Text className="text-[9px] font-outfitBold text-white/40 uppercase tracking-wider mt-0.5">Streak</Text>
                    </View>

                    <View className="items-center flex-1">
                      <View className="relative items-center justify-center">
                        <Text className="text-base font-outfitBold text-white">
                          {hasAccess ? (details?.stats.totalVolume || 0).toLocaleString() : "146"}
                        </Text>
                        {!hasAccess && (
                          <BlurView
                            intensity={30}
                            tint="dark"
                            experimentalBlurMethod="dimezisBlurView"
                            className="absolute -inset-1 rounded-md"
                          />
                        )}
                      </View>
                      <Text className="text-[9px] font-outfitBold text-white/40 uppercase tracking-wider mt-0.5">Total Volume</Text>
                    </View>
                  </View>

                  {/* Max PRs Grid */}
                  <View className="flex-row justify-between gap-2">
                    <View className="flex-1 bg-white/[0.03] rounded-xl p-2 items-center relative overflow-hidden">
                      <Text className="text-[9px] font-outfitMed text-white/50 mb-0.5">Max Pushups</Text>
                      <View className="relative items-center justify-center">
                        <Text className="text-sm font-outfitBold text-white">
                          {hasAccess ? (details?.stats.maxPushups?.reps || 0) : "64"} reps
                        </Text>
                        {!hasAccess && (
                          <BlurView
                            intensity={20}
                            tint="dark"
                            experimentalBlurMethod="dimezisBlurView"
                            className="absolute -inset-1 rounded-md"
                          />
                        )}
                      </View>
                    </View>

                    <View className="flex-1 bg-white/[0.03] rounded-xl p-2 items-center relative overflow-hidden">
                      <Text className="text-[9px] font-outfitMed text-white/50 mb-0.5">Max Squats</Text>
                      <View className="relative items-center justify-center">
                        <Text className="text-sm font-outfitBold text-white">
                          {hasAccess ? (details?.stats.maxSquats?.reps || 0) : "82"} reps
                        </Text>
                        {!hasAccess && (
                          <BlurView
                            intensity={20}
                            tint="dark"
                            experimentalBlurMethod="dimezisBlurView"
                            className="absolute -inset-1 rounded-md"
                          />
                        )}
                      </View>
                    </View>

                    <View className="flex-1 bg-white/[0.03] rounded-xl p-2 items-center relative overflow-hidden">
                      <Text className="text-[9px] font-outfitMed text-white/50 mb-0.5">Max Plank</Text>
                      <View className="relative items-center justify-center">
                        <Text className="text-sm font-outfitBold text-white">
                          {hasAccess ? formatTime(details?.stats.maxPlank?.duration || 0) : "3m 20s"}
                        </Text>
                        {!hasAccess && (
                          <BlurView
                            intensity={20}
                            tint="dark"
                            experimentalBlurMethod="dimezisBlurView"
                            className="absolute -inset-1 rounded-md"
                          />
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Pro Teaser Unlock Button (Floating over crisp block) */}
                  {!hasAccess && (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        executeIfPro(
                          () => { },
                          {
                            title: "Unlock Competitor Intel",
                            description: "Upgrade to Replix Pro to inspect competitor streaks, total volume, and max personal records.",
                            buttonText: "Upgrade to Pro"
                          }
                        );
                      }}
                      className="absolute inset-0 z-30 items-center justify-center"
                    >
                      <View className="items-center justify-center px-4 py-2 z-40 bg-[#141416]/95 rounded-xl border border-[#F0B35C]/35 shadow-2xl">
                        <View className="w-6 h-6 rounded-full bg-[#F0B35C]/20 items-center justify-center mb-0.5">
                          <Crown size={13} color="#F0B35C" />
                        </View>
                        <Text className="text-[10px] font-outfitBold text-[#F0B35C] text-center">
                          Tap to Unlock with Pro
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

            </View>
          )}
        </View>
      </View>

      {/* Friend Remove Confirmation Modal */}
      <ConfirmationModal
        visible={showRemoveModal}
        title="Remove Friend"
        description={`Are you sure you want to remove ${details?.profile.username || initialName || "this user"} from your friends list?`}
        confirmText="Remove"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleRemoveFriend}
        onCancel={() => setShowRemoveModal(false)}
        isLoading={isRemoving}
      />

      {/* Pro Paywall Modal */}
      <LockedFeatureModal
        visible={isProModalVisible}
        onClose={closeProModal}
        onUpgradePress={handleUpgradePress}
        title={modalConfig.title || "Unlock Competitor Intel"}
        description={
          modalConfig.description ||
          "Upgrade to Replix Pro to inspect competitor streaks, total volume, and max personal records."
        }
        buttonText={modalConfig.buttonText || "Upgrade to Pro"}
      />
    </View>
  );
}
