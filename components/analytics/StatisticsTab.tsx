import React from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { SkeletonBlock } from "@/components/loaders/SkeletonLoader";
import { StatisticsMetricHeader } from "./StatisticsMetricHeader";
import { StatisticsTrendChart } from "./StatisticsTrendChart";
import { StatisticsMetricGrid } from "./StatisticsMetricGrid";
import { TrendType } from "@/utils/analyticsFormatters";

interface StatisticsTabProps {
  isLoading: boolean;
  activeTrend: TrendType;
  selectedRange: "week" | "month" | "year";
  displayStats: any;
  screenWidth: number;
  selectedChartIndex: number | null;
  onRangeChange: (range: "week" | "month" | "year") => void;
  onSelectTrend: (trend: TrendType) => void;
  onSelectChartIndex: (idx: number | null) => void;
  statsAnimationStyle?: any;
  isPro?: boolean;
}

export const StatisticsTab = React.memo<StatisticsTabProps>(
  ({
    isLoading,
    activeTrend,
    selectedRange,
    displayStats,
    screenWidth,
    selectedChartIndex,
    onRangeChange,
    onSelectTrend,
    onSelectChartIndex,
    statsAnimationStyle,
    isPro = false,
  }) => {
    return (
      <View className="flex-1">
        {/* Toggle remains static and interactive (no skeleton on toggles) */}
        <StatisticsMetricHeader
          selectedRange={selectedRange}
          onRangeChange={onRangeChange}
          isPro={isPro}
        />

        {/* Global Block Skeleton loader below the Week / Month / Year toggle */}
        {isLoading ? (
          <View className="flex-1">
            {/* Chart Block Skeleton */}
            <SkeletonBlock
              width="100%"
              height={192}
              borderRadius={20}
              className="mb-4"
            />
            {/* 6-Card Metric Grid Skeletons */}
            <View className="flex-row flex-wrap justify-between gap-y-3 mb-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBlock
                  key={i}
                  width="48%"
                  height={76}
                  borderRadius={20}
                />
              ))}
            </View>
          </View>
        ) : (
          <Animated.View style={[statsAnimationStyle, { flex: 1 }]}>
            <StatisticsTrendChart
              activeTrend={activeTrend}
              selectedRange={selectedRange}
              displayStats={displayStats}
              screenWidth={screenWidth}
              selectedChartIndex={selectedChartIndex}
              onSelectChartIndex={onSelectChartIndex}
            />

            <StatisticsMetricGrid
              activeTrend={activeTrend}
              displayStats={displayStats}
              onSelectTrend={onSelectTrend}
            />
          </Animated.View>
        )}
      </View>
    );
  }
);

StatisticsTab.displayName = "StatisticsTab";
