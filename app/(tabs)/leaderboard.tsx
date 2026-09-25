import { LeaderboardTimeframe } from "@/services/social/leaderboardService";
import { LeaderboardEntry } from "@/types/leaderboard.types";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowUp, Award, Search, UserPlus } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  InteractionManager,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInUp, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { SkeletonBlock } from "../../components/loaders/SkeletonLoader";
import { LockedFeatureModal } from "../../components/modals/LockedFeatureModal";
import { InviteFriendButton } from "../../components/social/InviteFriendButton";
import { AnimatedSegmentedControl } from "../../components/ui/AnimatedSegmentedControl";
import { useProGuard } from "../../hooks/useProGuard";
import { useFriendStore } from "./../../store/social/friendStore";
import { useLeaderboardStore } from "./../../store/social/leaderboardStore";
import { useAuthStore } from "./../../store/user/authStore";

const CustomCrown = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 22h20 M4.5 19l-2.5-12 5.5 3 4.5-7 4.5 7 5.5-3-2.5 12h-15z"
      stroke="#FDE047"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="rgba(253, 224, 71, 0.4)"
    />
    <Path d="M12 4 L12 4.01" stroke="#FDE047" strokeWidth={3} strokeLinecap="round" />
    <Path d="M7 10 L7 10.01" stroke="#FDE047" strokeWidth={3} strokeLinecap="round" />
    <Path d="M17 10 L17 10.01" stroke="#FDE047" strokeWidth={3} strokeLinecap="round" />
  </Svg>
);

let isNavigatingGlobal = false;

import { LeaderboardCard } from "../../components/social/LeaderboardCard";
import { LeaderboardTop3Cards } from "../../components/social/LeaderboardTop3Cards";

// Reusable memoized card
const LeaderboardRow = LeaderboardCard;

const getNextMondayUTC = () => {
  const now = new Date();
  const daysUntilSunday = now.getUTCDay() === 0 ? 0 : 7 - now.getUTCDay();

  const nextSundayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSunday,
    23, 59, 59, 999
  ));
  return nextSundayUTC.getTime();
};

const getNextMonthUTC = () => {
  const now = new Date();
  const nextMonthUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
    0, 0, 0, 0
  ));
  return nextMonthUTC.getTime();
};

const useTimeframeTimer = (timeframe: LeaderboardTimeframe) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const target = timeframe === "weekly" ? getNextMondayUTC() : getNextMonthUTC();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft("0s");
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (d > 0) parts.push(`${d}d`);
      if (h > 0) parts.push(`${h}h`);
      if (m > 0) parts.push(`${m}m`);
      if (s > 0) parts.push(`${s}s`);

      setTimeLeft(parts.slice(0, 2).join(" ") || "0s");
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [timeframe]);

  return timeLeft;
};

export default function Leaderboard() {
  const screenHeight = Dimensions.get("window").height;
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string, action?: string }>();

  const {
    isPro,
    isProModalVisible,
    closeProModal,
    executeIfPro,
    handleUpgradePress,
    modalConfig,
  } = useProGuard();

  const setScope = useLeaderboardStore((s) => s.setScope);
  const setTimeframe = useLeaderboardStore((s) => s.setTimeframe);

  const { user } = useAuthStore();
  const currentUserId = user?.id ?? "guest";

  // Handle Push Notification Deep-Linking
  useEffect(() => {
    if (params.scope === "friends") {
      setScope("friends", currentUserId);
    }
    if (params.action === "requests") {
      router.navigate("/(social)/friend-requests" as any);
    }
  }, [params.scope, params.action, currentUserId, setScope, router]);

  const scope = useLeaderboardStore((s) => s.scope);
  const timeframe = useLeaderboardStore((s) => s.timeframe);
  const timeLeft = useTimeframeTimer(timeframe);
  const entries = useLeaderboardStore((s) => s.entries);
  const currentUserEntry = useLeaderboardStore((s) => s.currentUserEntry);
  const isLoading = useLeaderboardStore((s) => s.isLoading);
  const isFetchingNextPage = useLeaderboardStore((s) => s.isFetchingNextPage);

  const loadLeaderboard = useLeaderboardStore((s) => s.loadLeaderboard);
  const fetchNextPage = useLeaderboardStore((s) => s.fetchNextPage);

  const incomingRequests = useFriendStore((s) => s.incomingRequests);
  const loadRequests = useFriendStore((s) => s.loadRequests);
  const friends = useFriendStore((s) => s.friends);

  const [isScreenReady, setIsScreenReady] = useState(false);
  const [isCurrentUserVisible, setIsCurrentUserVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isFocused = useIsFocused();
  const isNavigatingRef = useRef(false);

  const safeNavigate = (path: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.navigate(path as any);
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 500);
  };

  const handleProfileNavigation = (id: string, name: string) => {
    if (isNavigatingGlobal || !id || id === "guest") return;
    isNavigatingGlobal = true;
    if (id === currentUserId) {
      router.navigate("/(tabs)/profile" as any);
    } else {
      router.push({ pathname: "/friend-profile", params: { id, name } });
    }
    setTimeout(() => { isNavigatingGlobal = false; }, 1000);
  };

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 400); // Appear after scrolling 400px down
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadRequests(user.id);
    }
  }, [user?.id, loadRequests]);

  useEffect(() => {
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      setIsScreenReady(true);
    });
    return () => interactionTask.cancel();
  }, []);

  useEffect(() => {
    if (isScreenReady) {
      void loadLeaderboard(currentUserId);
    }
  }, [scope, timeframe, currentUserId, isScreenReady, loadLeaderboard]);

  const viewOpacity = useSharedValue(0);
  const viewTranslateY = useSharedValue(-10);

  useEffect(() => {
    if (!isScreenReady) return;
    viewOpacity.value = 0;
    viewTranslateY.value = -10;
    viewOpacity.value = withTiming(1, { duration: 400 });
    viewTranslateY.value = withTiming(0, { duration: 400 });
  }, [scope, timeframe, isScreenReady, viewOpacity, viewTranslateY]);

  const dataAnimationStyle = useAnimatedStyle(() => ({
    opacity: viewOpacity.value,
    transform: [{ translateY: viewTranslateY.value }]
  }));

  const { top3, rest } = useMemo(() => {
    const top = entries.slice(0, 3);
    const others = entries.slice(3); // Rank 4+ for the FlatList
    const pod = [
      top[1] || { rank: 2, name: "-", avatar: null, score: 0, isCurrentUser: false },
      top[0] || { rank: 1, name: "-", avatar: null, score: 0, isCurrentUser: false },
      top[2] || { rank: 3, name: "-", avatar: null, score: 0, isCurrentUser: false },
    ];
    return { top3: pod, rest: others };
  }, [entries]);

  // If user is not visible in the current FlatList data, show sticky footer
  const showStickyFooter = useMemo(() => {
    if (!isScreenReady || isLoading) return false; // Prevent flashing while screen is building or data is loading
    if (scope === "friends") return false; // Friends list is small, no sticky needed
    if (!currentUserEntry) return false;

    // Check if user is in top 3
    if (entries.slice(0, 3).some(e => e.id === currentUserId)) return false;

    // Check if user is in the loaded 'rest' list
    const userIndexInRest = rest.findIndex(e => e.id === currentUserId);
    const isInLoadedData = userIndexInRest !== -1;

    if (!isInLoadedData) return true; // Not loaded yet

    // If user is in the top 7 items of 'rest', they are visible in initial viewport. 
    // This prevents the 500ms flash before onViewableItemsChanged fires.
    if (userIndexInRest < 7) return false;

    if (!isCurrentUserVisible) return true; // Loaded, but out of viewport

    return false;
  }, [isScreenReady, isLoading, scope, currentUserEntry, currentUserId, entries, rest, isCurrentUserVisible]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const isVisible = viewableItems.some((v: any) => v.item.id === currentUserId);
    setIsCurrentUserVisible(isVisible);
  }, [currentUserId]);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 10,
  }), []);

  const renderItem = useCallback(({ item }: { item: LeaderboardEntry }) => (
    <View className="mb-1">
      <LeaderboardRow userRes={item} />
    </View>
  ), []);

  const ListHeader = useCallback(() => (
    <LeaderboardTop3Cards
      entries={top3}
      onProfilePress={handleProfileNavigation}
      className="mt-[-20px] mb-8 px-2"
    />
  ), [top3, handleProfileNavigation]);

  const ListFooter = useCallback(() => {
    if (!isFetchingNextPage) return <View className="h-6" />;
    return (
      <View className="py-4 items-center justify-center">
        <ActivityIndicator size="small" color="#6D8C7A" />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <View className="flex-1 bg-transparent">
      <PremiumAmbientBackground />

      {/* Toggles and Header stay sticky at the top */}
      <View className="px-5 pt-3 bg-transparent">
        <View className="mt-2 mb-2.5 flex-row justify-between items-center">
          <View>

            <Text className="text-2xl font-outfitBold tracking-tight text-brand-charcoal">
              Leaderboard
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="bg-brand-warning/10 px-1.5 py-0.5 rounded border border-brand-warning/20">
                <Text className="text-[9px] font-outfitBold text-brand-warning tracking-wide">
                  {timeframe === "weekly" ? `Week Ends in ${timeLeft}` : `Month Ends in ${timeLeft}`}
                </Text>
              </View>
            </View>
          </View>
          {scope === "friends" && (
            <View className="flex-row items-center gap-1">
              <TouchableOpacity
                onPress={() => safeNavigate("/(social)/friend-requests")}
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
                <UserPlus size={11} color="#A1A1AA" />
                <Text className="text-[8px] font-outfitBold uppercase tracking-wider text-white">
                  Requests
                </Text>
                {incomingRequests.length > 0 && (
                  <View className="w-1.5 h-1.5 bg-brand-warning rounded-full" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => safeNavigate("/(social)/search-friends")}
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
                <Search size={11} color="#A1A1AA" />
                <Text className="text-[8px] font-outfitBold uppercase tracking-wider text-white">
                  Search
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View className="mb-3 w-full">
          <AnimatedSegmentedControl
            options={[
              { label: "Global", value: "global", fontSize: 10 },
              { label: "Friends", value: "friends", fontSize: 10, badge: incomingRequests.length > 0 }
            ]}
            activeOption={scope}
            onOptionPress={(val: any) => setScope(val, currentUserId)}
            itemPaddingVertical={6}
          />
        </View>

        {scope === "global" && (
          <View className="mb-3 w-full">
            <AnimatedSegmentedControl
              options={[
                { label: "This Week", value: "weekly", fontSize: 10 },
                { label: "This Month", value: "monthly", fontSize: 10, isLocked: !isPro }
              ]}
              activeOption={timeframe}
              onOptionPress={(val: any) => {
                if (val === "monthly") {
                  executeIfPro(
                    () => setTimeframe(val as LeaderboardTimeframe, currentUserId),
                    {
                      title: "Unlock Monthly Leaderboard",
                      description: "Upgrade to Replix Pro to view full monthly rankings and see where you stand on the global leaderboard.",
                      buttonText: "Upgrade to Pro"
                    }
                  );
                } else {
                  setTimeframe(val as LeaderboardTimeframe, currentUserId);
                }
              }}
              itemPaddingVertical={6}
            />
          </View>
        )}
      </View>

      {/* Main Content Area */}
      <View className="flex-1 relative">
        {isScreenReady && (
          <Animated.View style={[{ flex: 1 }, dataAnimationStyle]}>
            {isLoading ? (
              <View className="flex-1 pt-1">
                {/* Accurate Top 3 Podium Skeleton */}
                <View className="mt-[-20px] mb-8 px-2 flex-row justify-between items-end h-[220px] gap-2">

                  {/* 2nd Place */}
                  <View className="flex-1 items-center justify-end h-full">
                    <View className="items-center w-full z-10">
                      <View className="relative items-center mb-[-24px] z-20">
                        <SkeletonBlock width={56} height={56} borderRadius={28} className="border-[3px] border-[#121212]" />
                      </View>
                      <LinearGradient
                        colors={["rgba(148,163,184,0.15)", "rgba(148,163,184,0.02)"]}
                        style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
                        className="w-full items-center pt-10 pb-4 px-1 border-t border-x border-slate-400/20 h-[110px]"
                      >
                        <SkeletonBlock width="70%" height={12} borderRadius={4} className="mb-2 opacity-30" />
                        <SkeletonBlock width="40%" height={16} borderRadius={4} className="opacity-30" />
                      </LinearGradient>
                    </View>
                  </View>

                  {/* 1st Place */}
                  <View className="flex-[1.2] items-center justify-end h-full">
                    <View className="items-center w-full z-20">
                      <View className="relative items-center mb-[-32px] z-30">
                        <SkeletonBlock width={72} height={72} borderRadius={36} className="border-[3px] border-[#121212]" />
                      </View>
                      <LinearGradient
                        colors={["rgba(251,191,36,0.25)", "rgba(217,119,6,0.05)"]}
                        style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
                        className="w-full items-center pt-12 pb-6 px-1 border-t-2 border-x-2 border-[#FDE047]/40 h-[145px]"
                      >
                        <SkeletonBlock width="75%" height={14} borderRadius={4} className="mb-2 opacity-30" />
                        <SkeletonBlock width="45%" height={18} borderRadius={4} className="opacity-30" />
                      </LinearGradient>
                    </View>
                  </View>

                  {/* 3rd Place */}
                  <View className="flex-1 items-center justify-end h-full">
                    <View className="items-center w-full z-10">
                      <View className="relative items-center mb-[-24px] z-20">
                        <SkeletonBlock width={56} height={56} borderRadius={28} className="border-[3px] border-[#121212]" />
                      </View>
                      <LinearGradient
                        colors={["rgba(253,186,116,0.15)", "rgba(234,88,12,0.02)"]}
                        style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
                        className="w-full items-center pt-10 pb-4 px-1 border-t border-x border-[#FDBA74]/30 h-[95px]"
                      >
                        <SkeletonBlock width="70%" height={12} borderRadius={4} className="mb-2 opacity-30" />
                        <SkeletonBlock width="40%" height={16} borderRadius={4} className="opacity-30" />
                      </LinearGradient>
                    </View>
                  </View>

                </View>

                {/* Accurate FlatList Row Skeletons */}
                <View className="px-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <View key={i} className="mb-2">
                      <LinearGradient
                        colors={["rgba(42,42,42,0.6)", "rgba(22,22,22,0.4)"]}
                        style={{ borderRadius: 16 }}
                        className="px-4 py-3 flex-row justify-between items-center border border-white/5"
                      >
                        <View className="flex-row items-center flex-1 pr-2">
                          {/* Rank Badge */}
                          <View className="w-8 h-8 mr-3 rounded-full overflow-hidden">
                            <LinearGradient
                              colors={["#2A2A2A", "#161616"]}
                              style={{ flex: 1, borderRadius: 16 }}
                              className="border border-white/10"
                            />
                          </View>

                          <SkeletonBlock width={40} height={40} borderRadius={20} className="border-2 border-white/10" />

                          <View className="ml-3 flex-1 justify-center">
                            <SkeletonBlock width="60%" height={14} borderRadius={4} className="mb-1.5 opacity-40" />
                            <SkeletonBlock width="30%" height={10} borderRadius={4} className="opacity-40" />
                          </View>
                        </View>

                        <View className="items-end">
                          <SkeletonBlock width={30} height={18} borderRadius={4} className="mb-1 opacity-40" />
                          <SkeletonBlock width={16} height={8} borderRadius={2} className="opacity-40" />
                        </View>
                      </LinearGradient>
                    </View>
                  ))}
                </View>
              </View>
            ) : scope === "friends" && friends.length === 0 ? (
              <View className="items-center justify-center flex-1 py-12 px-8">
                <Text className="text-xl font-outfitBold text-white mb-3 text-center">
                  It's quiet here...
                </Text>
                <Text className="text-sm font-outfitReg text-brand-charcoal text-center mb-8 max-w-[280px]">
                  Add friends to start competing on the weekly leaderboard and see who's putting in the most work!
                </Text>

                <View className="w-full flex-col space-y-4 max-w-[280px] gap-4">
                  <TouchableOpacity
                    onPress={() => {
                      router.navigate("/(social)/search-friends" as any);
                    }}
                    className="bg-brand-forest w-full py-4 rounded-2xl shadow-lg shadow-brand-forest/30 flex-row items-center justify-center active:opacity-80"
                  >
                    <UserPlus size={18} color="white" />
                    <Text className="text-sm font-outfitBold text-white uppercase tracking-widest ml-3">
                      Add Friends
                    </Text>
                  </TouchableOpacity>

                  <InviteFriendButton className="w-full py-4" />
                </View>
              </View>
            ) : entries.length === 0 ? (
              <View className="items-center py-8 space-y-2">
                <Award size={32} color="#9F9F99" className="mb-2 opacity-40" />
                <Text className="text-xs font-outfitBold text-brand-charcoal mb-2">
                  No data available
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                data={rest}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onEndReached={() => fetchNextPage(currentUserId)}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
              />
            )}
          </Animated.View>
        )}

        {/* STICKY FOOTER for Current User */}
        {showStickyFooter && currentUserEntry && (
          <Animated.View
            entering={FadeInUp.duration(300)}
            exiting={FadeOutDown.duration(300)}
            className="absolute bottom-[65px] left-5 right-5 z-50"
          >
            <LeaderboardRow userRes={currentUserEntry} isSticky={true} />
          </Animated.View>
        )}

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <Animated.View
            entering={FadeInUp.duration(300)}
            exiting={FadeOutDown.duration(300)}
            className={`absolute right-5 z-[60] ${showStickyFooter ? "bottom-[160px]" : "bottom-[90px]"}`}
          >
            <TouchableOpacity
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              className="w-12 h-12 rounded-full bg-[#3A9E66] border border-[#3A9E66]/80 items-center justify-center shadow-lg shadow-[#3A9E66]/30"
              activeOpacity={0.8}
            >
              <ArrowUp size={20} color="#FFFFFF" strokeWidth={3} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* Pro Paywall / Feature Gate Modal */}
      <LockedFeatureModal
        visible={isProModalVisible}
        onClose={closeProModal}
        onUpgradePress={handleUpgradePress}
        title={modalConfig.title || "Unlock Monthly Leaderboard"}
        description={
          modalConfig.description ||
          "Upgrade to Replix Pro to view full monthly rankings and see where you stand on the global leaderboard."
        }
        buttonText={modalConfig.buttonText || "Upgrade to Pro"}
      />
    </View>
  );
}