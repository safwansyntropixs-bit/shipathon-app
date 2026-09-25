import { DayPickerModal } from "@/components/analytics/DayPickerModal";
import { HistoryTab } from "@/components/analytics/HistoryTab";
import { PersonalRecordsBanner } from "@/components/analytics/PersonalRecordsBanner";
import { StatisticsTab } from "@/components/analytics/StatisticsTab";
import { PremiumAmbientBackground } from "@/components/layout/PremiumAmbientBackground";
import { LockedFeatureModal } from "@/components/modals/LockedFeatureModal";
import { AnimatedSegmentedControl } from "@/components/ui/AnimatedSegmentedControl";
import { useProGuard } from "@/hooks/useProGuard";
import { useStreakStore } from "@/store/gamification/streakStore";
import { useAuthStore } from "@/store/user/authStore";
import { useDashboardStore } from "@/store/workout/dashboardStore";
import { useHistoryStore } from "@/store/workout/historyStore";
import { TrendType } from "@/utils/analyticsFormatters";
import { useFocusEffect } from "expo-router";
import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, InteractionManager, View } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type TabView = "history" | "statistics";

export default function Analytics() {
  const [activeView, setActiveView] = useState<TabView>("history");
  const { user } = useAuthStore();
  const {
    isPro,
    isProModalVisible,
    closeProModal,
    executeIfPro,
    handleUpgradePress,
    modalConfig,
  } = useProGuard();

  const {
    selectedMonthDate,
    selectedDay,
    filterType,
    history,
    isLoading: isHistoryLoading,
    isLoadingMore,
    isRangeStatsLoading,
    personalRecords,
    hasMore,
    error: historyError,
    loadInitialHistory,
    loadMoreHistory,
    loadPersonalRecords,
    setSelectedMonth,
    setSelectedDay,
    setFilterType,
    rangeStats,
    loadRangeStats,
  } = useHistoryStore();

  const loadStreakData = useStreakStore((state) => state.loadStreakData);
  const dashboardData = useDashboardStore((state) => state.data);
  const isDashboardLoading = useDashboardStore((state) => state.isLoading);
  const loadDashboardData = useDashboardStore((state) => state.loadDashboardData);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<"week" | "month" | "year">("week");
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);
  const [activeTrend, setActiveTrend] = useState<TrendType>("time");
  const [isDayPickerVisible, setIsDayPickerVisible] = useState(false);
  const [isScreenReady, setIsScreenReady] = useState(false);

  // Defer heavy UI interactions until transitions resolve
  useEffect(() => {
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      setIsScreenReady(true);
    });
    return () => interactionTask.cancel();
  }, []);

  // Screen Focus Effect: Ensure PRs and active history are fresh on focus/return
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadPersonalRecords(user.id);
        const currentHistory = useHistoryStore.getState().history;
        if (currentHistory.length === 0) {
          loadInitialHistory(user.id, isPro);
        }
      }
    }, [user?.id, isPro, loadPersonalRecords, loadInitialHistory])
  );

  // Initial load
  useEffect(() => {
    if (isScreenReady && user?.id) {
      loadInitialHistory(user.id, isPro);
      loadStreakData(user.id);
      loadDashboardData(user.id);
    }
  }, [user?.id, isScreenReady, isPro, loadInitialHistory, loadStreakData, loadDashboardData]);

  // DB Range stats fetch on range change
  useEffect(() => {
    if (isScreenReady && user?.id) {
      loadRangeStats(user.id, selectedRange, isPro);
    }
  }, [user?.id, isScreenReady, loadRangeStats, selectedRange, isPro]);

  // Auto-reset selectedRange to "week" if Pro status expires while viewing month/year
  useEffect(() => {
    if (!isPro && (selectedRange === "month" || selectedRange === "year")) {
      setSelectedRange("week");
    }
  }, [isPro, selectedRange]);

  // Stats Range Animation (smooth transition when switching Week/Month/Year)
  const statsOpacity = useSharedValue(0);
  const statsTranslateY = useSharedValue(-6);
  useEffect(() => {
    if (!isScreenReady) return;
    statsOpacity.value = 0;
    statsTranslateY.value = -6;
    statsOpacity.value = withTiming(1, { duration: 250 });
    statsTranslateY.value = withTiming(0, { duration: 250 });
  }, [selectedRange, isScreenReady, statsOpacity, statsTranslateY]);

  const statsAnimationStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
    transform: [{ translateY: statsTranslateY.value }],
  }));

  // Month navigation boundaries
  const now = new Date();
  const isNextDisabled =
    selectedMonthDate.getFullYear() > now.getFullYear() ||
    (selectedMonthDate.getFullYear() === now.getFullYear() &&
      selectedMonthDate.getMonth() >= now.getMonth());

  const handlePrevMonth = useCallback(() => {
    executeIfPro(
      () => {
        if (!user?.id) return;
        const prev = new Date(
          selectedMonthDate.getFullYear(),
          selectedMonthDate.getMonth() - 1,
          1
        );
        setSelectedMonth(prev, user.id, true);
      },
      {
        title: "Unlock History Archive",
        description:
          "Access your complete workout history and training logs across all past months with Replix Pro.",
        buttonText: "Upgrade to Pro",
      }
    );
  }, [executeIfPro, selectedMonthDate, user?.id, setSelectedMonth]);

  const handleNextMonth = useCallback(() => {
    if (!user?.id || isNextDisabled) return;
    const next = new Date(
      selectedMonthDate.getFullYear(),
      selectedMonthDate.getMonth() + 1,
      1
    );
    setSelectedMonth(next, user.id, isPro);
  }, [selectedMonthDate, isNextDisabled, user?.id, isPro, setSelectedMonth]);

  const handleOpenCalendar = useCallback(() => {
    setIsDayPickerVisible(true);
  }, []);

  const handleSelectDay = useCallback(
    (day: number | null) => {
      if (!user?.id) return;
      setSelectedDay(day, user.id, isPro);
    },
    [user?.id, isPro, setSelectedDay]
  );

  const handleClearDayFilter = useCallback(() => {
    if (!user?.id) return;
    setSelectedDay(null, user.id, isPro);
  }, [user?.id, isPro, setSelectedDay]);

  const handleFilterClick = useCallback(
    (type: string) => {
      if (type === filterType) return;
      startTransition(() => {
        if (user?.id) setFilterType(type, user.id, isPro);
      });
    },
    [filterType, user?.id, isPro, setFilterType]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleEndReached = useCallback(() => {
    if (user?.id && hasMore && !isHistoryLoading && !isLoadingMore) {
      loadMoreHistory(user.id, isPro);
    }
  }, [user?.id, hasMore, isHistoryLoading, isLoadingMore, loadMoreHistory, isPro]);

  const handleRangeChange = useCallback(
    (range: "week" | "month" | "year") => {
      if (selectedRange === range) return;
      if (range === "month" || range === "year") {
        executeIfPro(
          () => {
            if (user?.id) loadRangeStats(user.id, range, isPro);
            startTransition(() => setSelectedRange(range));
          },
          {
            title: "Unlock Advanced Analytics",
            description:
              "Access in-depth monthly and yearly training trends, volume progression, and biomechanical accuracy curves with Replix Pro.",
            buttonText: "Upgrade to Pro",
          }
        );
      } else {
        if (user?.id) loadRangeStats(user.id, range, isPro);
        startTransition(() => setSelectedRange(range));
      }
    },
    [selectedRange, user?.id, loadRangeStats, executeIfPro, isPro]
  );

  const screenWidth = Dimensions.get("window").width - 80;

  const displayStats = useMemo(() => {
    if (rangeStats) {
      return {
        labelPrefix:
          rangeStats.labelPrefix ||
          (selectedRange === "week" ? "Weekly" : selectedRange === "month" ? "Monthly" : "Yearly"),
        reps: rangeStats.reps || 0,
        workouts: rangeStats.workouts ?? rangeStats.sets ?? 0,
        timeSec: rangeStats.timeSec || 0,
        timeMin: rangeStats.timeMin || 0,
        pushupReps: rangeStats.pushupReps || 0,
        squatReps: rangeStats.squatReps || 0,
        plankTimeSec: rangeStats.plankTimeSec || 0,
        plankTimeMin: rangeStats.plankTimeMin || 0,
        pushupAccuracy: Math.round(rangeStats.pushupAccuracy || 0),
        squatAccuracy: Math.round(rangeStats.squatAccuracy || 0),
        plankAccuracy: Math.round(rangeStats.plankAccuracy || 0),
        accuracy: Math.round(rangeStats.accuracy || 0),
        trend:
          rangeStats.trend ||
          (selectedRange === "week"
            ? [0, 0, 0, 0, 0, 0, 0]
            : selectedRange === "month"
              ? [0, 0, 0, 0]
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        timeTrend:
          rangeStats.timeTrend ||
          (selectedRange === "week"
            ? [0, 0, 0, 0, 0, 0, 0]
            : selectedRange === "month"
              ? [0, 0, 0, 0]
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        setsTrend:
          rangeStats.setsTrend ||
          (selectedRange === "week"
            ? [0, 0, 0, 0, 0, 0, 0]
            : selectedRange === "month"
              ? [0, 0, 0, 0]
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        repsTrend:
          rangeStats.repsTrend ||
          (selectedRange === "week"
            ? [0, 0, 0, 0, 0, 0, 0]
            : selectedRange === "month"
              ? [0, 0, 0, 0]
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        pushupTrend:
          rangeStats.pushupTrend ||
          (selectedRange === "week"
            ? [0, 0, 0, 0, 0, 0, 0]
            : selectedRange === "month"
              ? [0, 0, 0, 0]
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        squatTrend:
          rangeStats.squatTrend ||
          (selectedRange === "week"
            ? [0, 0, 0, 0, 0, 0, 0]
            : selectedRange === "month"
              ? [0, 0, 0, 0]
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        plankTrend:
          rangeStats.plankTrend ||
          (selectedRange === "week"
            ? [0, 0, 0, 0, 0, 0, 0]
            : selectedRange === "month"
              ? [0, 0, 0, 0]
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        labels:
          rangeStats.labels ||
          (selectedRange === "week"
            ? ["M", "T", "W", "T", "F", "S", "S"]
            : selectedRange === "month"
              ? ["W1", "W2", "W3", "W4"]
              : ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]),
      };
    }
    const isWeek = selectedRange === "week";
    return {
      labelPrefix:
        selectedRange === "week"
          ? "Weekly"
          : selectedRange === "month"
            ? "Monthly"
            : "Yearly",
      reps: isWeek ? (dashboardData?.weeklyReps || 0) : 0,
      workouts: isWeek ? (dashboardData?.weeklySets || 0) : 0,
      timeSec: isWeek ? ((dashboardData?.totalTimeMin || 0) * 60) : 0,
      timeMin: isWeek ? (dashboardData?.totalTimeMin || 0) : 0,
      pushupReps: isWeek ? (dashboardData?.pushupReps || 0) : 0,
      squatReps: isWeek ? (dashboardData?.squatReps || 0) : 0,
      plankTimeSec: isWeek ? ((dashboardData?.plankTimeMin || 0) * 60) : 0,
      plankTimeMin: isWeek ? (dashboardData?.plankTimeMin || 0) : 0,
      pushupAccuracy: isWeek ? Math.round(dashboardData?.weeklyPushupAccuracy || 0) : 0,
      squatAccuracy: isWeek ? Math.round(dashboardData?.weeklySquatAccuracy || 0) : 0,
      plankAccuracy: 0,
      accuracy: 0,
      trend: isWeek
        ? (dashboardData?.accuracyTrend || [0, 0, 0, 0, 0, 0, 0])
        : selectedRange === "month"
          ? [0, 0, 0, 0]
          : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      timeTrend:
        selectedRange === "week"
          ? [0, 0, 0, 0, 0, 0, 0]
          : selectedRange === "month"
            ? [0, 0, 0, 0]
            : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      setsTrend:
        selectedRange === "week"
          ? [0, 0, 0, 0, 0, 0, 0]
          : selectedRange === "month"
            ? [0, 0, 0, 0]
            : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      repsTrend:
        selectedRange === "week"
          ? [0, 0, 0, 0, 0, 0, 0]
          : selectedRange === "month"
            ? [0, 0, 0, 0]
            : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pushupTrend:
        selectedRange === "week"
          ? [0, 0, 0, 0, 0, 0, 0]
          : selectedRange === "month"
            ? [0, 0, 0, 0]
            : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      squatTrend:
        selectedRange === "week"
          ? [0, 0, 0, 0, 0, 0, 0]
          : selectedRange === "month"
            ? [0, 0, 0, 0]
            : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      plankTrend:
        selectedRange === "week"
          ? [0, 0, 0, 0, 0, 0, 0]
          : selectedRange === "month"
            ? [0, 0, 0, 0]
            : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      labels:
        selectedRange === "week"
          ? ["M", "T", "W", "T", "F", "S", "S"]
          : selectedRange === "month"
            ? ["W1", "W2", "W3", "W4"]
            : ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    };
  }, [rangeStats, selectedRange, dashboardData]);

  return (
    <View className="flex-1 bg-transparent">
      <PremiumAmbientBackground />

      {/* Main Tab Segmented Control (History / Statistics) */}
      <View className="px-6 pt-6 pb-2 mt-4 z-10">
        <AnimatedSegmentedControl
          options={[
            { label: "History", value: "history" },
            { label: "Statistics", value: "statistics" },
          ]}
          activeOption={activeView}
          onOptionPress={(val: any) => setActiveView(val)}
        />
      </View>

      {/* Max Box PR Banner */}
      <PersonalRecordsBanner
        personalRecords={personalRecords}
        hasError={!!historyError}
      />

      {/* HISTORY VIEW */}
      <View
        style={{
          display: activeView === "history" ? "flex" : "none",
          flex: 1,
        }}
      >
        {isScreenReady && (
          <View className="flex-1 px-6 mt-[-5px]">
            <HistoryTab
              history={history}
              isHistoryLoading={isHistoryLoading}
              isLoadingMore={isLoadingMore}
              historyError={historyError}
              selectedMonthDate={selectedMonthDate}
              selectedDay={selectedDay}
              filterType={filterType}
              isNextDisabled={isNextDisabled}
              isPro={isPro}
              expandedId={expandedId}
              onToggleExpand={toggleExpand}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onOpenCalendar={handleOpenCalendar}
              onClearDayFilter={handleClearDayFilter}
              onFilterClick={handleFilterClick}
              onEndReached={handleEndReached}
            />
          </View>
        )}
      </View>

      {/* STATISTICS VIEW */}
      <View
        style={{
          display: activeView === "statistics" ? "flex" : "none",
          flex: 1,
        }}
      >
        {isScreenReady && (
          <View className="flex-1 px-6 pb-4 mt-[-5px]">
            <StatisticsTab
              isLoading={isDashboardLoading || isRangeStatsLoading}
              activeTrend={activeTrend}
              selectedRange={selectedRange}
              displayStats={displayStats}
              screenWidth={screenWidth}
              selectedChartIndex={selectedChartIndex}
              onRangeChange={handleRangeChange}
              onSelectTrend={setActiveTrend}
              onSelectChartIndex={setSelectedChartIndex}
              statsAnimationStyle={statsAnimationStyle}
              isPro={isPro}
            />
          </View>
        )}
      </View>

      {/* Calendar Day Picker Modal */}
      <DayPickerModal
        visible={isDayPickerVisible}
        onClose={() => setIsDayPickerVisible(false)}
        selectedDate={selectedMonthDate}
        selectedDay={selectedDay}
        onSelectDay={handleSelectDay}
      />

      {/* Pro Upgrade Bottom Sheet Modal */}
      <LockedFeatureModal
        visible={isProModalVisible}
        onClose={closeProModal}
        onUpgradePress={handleUpgradePress}
        title={modalConfig.title}
        description={modalConfig.description}
        buttonText={modalConfig.buttonText}
      />
    </View>
  );
}