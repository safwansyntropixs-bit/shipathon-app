import React from "react";
import { View } from "react-native";
import { AnimatedSegmentedControl } from "@/components/ui/AnimatedSegmentedControl";

interface StatisticsMetricHeaderProps {
  selectedRange: "week" | "month" | "year";
  onRangeChange: (range: "week" | "month" | "year") => void;
  isPro?: boolean;
}

export const StatisticsMetricHeader = React.memo<StatisticsMetricHeaderProps>(
  ({ selectedRange, onRangeChange, isPro = false }) => {
    return (
      <View className="w-full mb-4 mt-1">
        <AnimatedSegmentedControl
          options={[
            { label: "Week", value: "week", fontSize: 10 },
            { label: "Month", value: "month", fontSize: 10, isLocked: !isPro },
            { label: "Year", value: "year", fontSize: 10, isLocked: !isPro },
          ]}
          activeOption={selectedRange}
          onOptionPress={(val: any) => onRangeChange(val)}
          itemPaddingVertical={7}
          itemFlex={true}
        />
      </View>
    );
  }
);

StatisticsMetricHeader.displayName = "StatisticsMetricHeader";
