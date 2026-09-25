import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { formatTime, TrendOption, TrendType } from "@/utils/analyticsFormatters";

interface StatisticsMetricGridProps {
  activeTrend: TrendType;
  displayStats: any;
  onSelectTrend: (trend: TrendType) => void;
}

export const StatisticsMetricGrid = React.memo<StatisticsMetricGridProps>(
  ({ activeTrend, displayStats, onSelectTrend }) => {
    const trendOptions: TrendOption[] = [
      {
        id: "time",
        label: "Duration",
        value: formatTime(displayStats.timeSec),
        unit: "",
      },
      {
        id: "workouts",
        label: "Workouts",
        value: displayStats.workouts,
        unit: "sessions",
      },
      {
        id: "pushups",
        label: "Push-ups",
        value: displayStats.pushupReps,
        unit: "reps",
      },
      {
        id: "squats",
        label: "Squats",
        value: displayStats.squatReps,
        unit: "reps",
      },
      {
        id: "planks",
        label: "Planks",
        value: formatTime(displayStats.plankTimeSec),
        unit: "",
      },
      {
        id: "accuracy",
        label: "Accuracy",
        value: displayStats.accuracy,
        unit: "%",
      },
    ];

    return (
      <View className="flex-row flex-wrap justify-between gap-y-3 mb-2">
        {trendOptions.map((opt) => {
          const isActive = activeTrend === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onSelectTrend(opt.id)}
              activeOpacity={0.8}
              style={{ width: "48%" }}
              className={`p-4 rounded-[20px] border ${
                isActive
                  ? "bg-[#3A9E66]/10 border-[#3A9E66]/30"
                  : "bg-white/[0.03] border-white/5"
              }`}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text
                  className={`text-[9px] font-outfitMed uppercase tracking-[0.15em] ${
                    isActive ? "text-[#3A9E66]" : "text-white/40"
                  }`}
                >
                  {opt.label}
                </Text>
              </View>
              <View className="flex-row items-baseline gap-1">
                <Text
                  className={`text-2xl font-outfitBold tracking-tight ${
                    isActive ? "text-white" : "text-white/70"
                  }`}
                >
                  {opt.value}
                </Text>
                {opt.unit ? (
                  <Text
                    className={`text-[9px] font-outfitMed uppercase tracking-widest ${
                      isActive ? "text-[#3A9E66]/80" : "text-white/30"
                    }`}
                  >
                    {opt.unit}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
);

StatisticsMetricGrid.displayName = "StatisticsMetricGrid";
