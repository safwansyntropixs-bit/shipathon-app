import React, { useMemo } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { MonthSwitcher } from "./MonthSwitcher";
import { WorkoutCard } from "./WorkoutCard";
import { AnimatedSegmentedControl } from "@/components/ui/AnimatedSegmentedControl";
import { SkeletonBlock } from "@/components/loaders/SkeletonLoader";
import { HistoryItem } from "@/services/workout/historyService";
import {
  EXERCISE_FILTERS,
  getFilterLabel,
  MONTH_NAMES,
} from "@/utils/analyticsFormatters";

interface HistoryTabProps {
  history: HistoryItem[];
  isHistoryLoading: boolean;
  isLoadingMore: boolean;
  historyError: string | null;
  selectedMonthDate: Date;
  selectedDay: number | null;
  filterType: string;
  isNextDisabled: boolean;
  isPro: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenCalendar: () => void;
  onClearDayFilter: () => void;
  onFilterClick: (type: string) => void;
  onEndReached: () => void;
}

export const HistoryTab = React.memo<HistoryTabProps>(
  ({
    history,
    isHistoryLoading,
    isLoadingMore,
    historyError,
    selectedMonthDate,
    selectedDay,
    filterType,
    isNextDisabled,
    isPro,
    expandedId,
    onToggleExpand,
    onPrevMonth,
    onNextMonth,
    onOpenCalendar,
    onClearDayFilter,
    onFilterClick,
    onEndReached,
  }) => {
    const listHeader = useMemo(
      () => (
        <View style={{ width: "100%" }}>
          {/* Month Switcher Header */}
          <MonthSwitcher
            currentDate={selectedMonthDate}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onOpenCalendar={onOpenCalendar}
            isNextDisabled={isNextDisabled}
            isCalendarDisabled={
              isHistoryLoading || (history.length === 0 && selectedDay === null)
            }
            selectedDay={selectedDay}
            onClearDayFilter={onClearDayFilter}
            isLocked={!isPro}
          />

          {/* Exercise Filter Control */}
          <View className="mb-4 w-full">
            <AnimatedSegmentedControl
              options={EXERCISE_FILTERS.map((f) => ({
                label: getFilterLabel(f),
                value: f,
                fontSize: 10,
              }))}
              activeOption={filterType}
              onOptionPress={onFilterClick}
              itemPaddingVertical={6}
            />
          </View>

          {/* Skeletons when initial loading */}
          {isHistoryLoading ? (
            <View className="mt-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  className="bg-white/5 border border-[#3A9E66]/30 rounded-2xl p-4 shadow-sm mb-3"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center mb-1.5">
                        <SkeletonBlock
                          width={70}
                          height={16}
                          borderRadius={4}
                          className="opacity-40"
                        />
                        <SkeletonBlock
                          width={60}
                          height={12}
                          borderRadius={4}
                          className="opacity-30 ml-3"
                        />
                      </View>
                      <View className="flex-row items-center mt-1">
                        <SkeletonBlock
                          width={90}
                          height={12}
                          borderRadius={4}
                          className="opacity-40"
                        />
                      </View>
                    </View>
                    <View className="items-end">
                      <SkeletonBlock
                        width={45}
                        height={18}
                        borderRadius={4}
                        className="mb-1 opacity-40"
                      />
                      <SkeletonBlock
                        width={35}
                        height={10}
                        borderRadius={4}
                        className="opacity-40"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Error state */}
          <View
            style={{ display: historyError ? "flex" : "none" }}
            className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 mb-4"
          >
            <Text className="text-sm text-red-400 font-outfitMed text-center">
              {historyError}
            </Text>
          </View>

          {/* Clean Empty State */}
          <View
            style={{
              display:
                !isHistoryLoading && !historyError && history.length === 0
                  ? "flex"
                  : "none",
            }}
            className="p-8 items-center justify-center"
          >
            <View className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center mb-3">
              <Text className="text-2xl">⚡</Text>
            </View>
            <Text className="text-white font-outfitBold text-base mb-1">
              No Workouts Found
            </Text>
            <Text className="text-white/50 font-outfitReg text-xs text-center">
              {selectedDay !== null
                ? `No recorded activity on ${
                    MONTH_NAMES[selectedMonthDate.getMonth()]
                  } ${selectedDay}.`
                : `No recorded workouts for ${
                    MONTH_NAMES[selectedMonthDate.getMonth()]
                  } ${selectedMonthDate.getFullYear()}.`}
            </Text>
          </View>
        </View>
      ),
      [
        selectedMonthDate,
        onPrevMonth,
        onNextMonth,
        onOpenCalendar,
        isNextDisabled,
        selectedDay,
        onClearDayFilter,
        filterType,
        onFilterClick,
        isHistoryLoading,
        isPro,
        historyError,
        history.length,
      ]
    );

    const listFooter = useMemo(() => {
      if (isLoadingMore) {
        return (
          <View className="py-4 items-center justify-center">
            <ActivityIndicator size="small" color="#3A9E66" />
          </View>
        );
      }
      return <View style={{ width: "100%", paddingBottom: 80 }} />;
    }, [isLoadingMore]);

    return (
      <FlatList
        data={!isHistoryLoading && !historyError ? history : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <WorkoutCard
            item={item}
            isExpanded={expandedId === item.id}
            onToggle={onToggleExpand}
          />
        )}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  }
);

HistoryTab.displayName = "HistoryTab";
