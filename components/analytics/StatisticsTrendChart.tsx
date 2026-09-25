import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { formatTime, TrendType } from "@/utils/analyticsFormatters";

interface StatisticsTrendChartProps {
  activeTrend: TrendType;
  selectedRange: "week" | "month" | "year";
  displayStats: any;
  screenWidth: number;
  chartHeight?: number;
  selectedChartIndex: number | null;
  onSelectChartIndex: (idx: number | null) => void;
}

const getTrendTitle = (trend: TrendType): string => {
  switch (trend) {
    case "accuracy":
      return "Accuracy";
    case "time":
      return "Duration";
    case "workouts":
      return "Workouts";
    case "pushups":
      return "Push-ups";
    case "squats":
      return "Squats";
    case "planks":
      return "Planks";
  }
};

export const StatisticsTrendChart = React.memo<StatisticsTrendChartProps>(
  ({
    activeTrend,
    selectedRange,
    displayStats,
    screenWidth,
    chartHeight = 100,
    selectedChartIndex,
    onSelectChartIndex,
  }) => {
    const curve = useMemo(() => {
      let data;
      if (activeTrend === "accuracy") data = displayStats.trend;
      else if (activeTrend === "time") data = displayStats.timeTrend;
      else if (activeTrend === "workouts") data = displayStats.setsTrend;
      else if (activeTrend === "pushups") data = displayStats.pushupTrend;
      else if (activeTrend === "squats") data = displayStats.squatTrend;
      else if (activeTrend === "planks") data = displayStats.plankTrend;

      if (!data || data.length === 0) {
        return {
          path: "",
          points: [],
          lastPoint: { x: 0, y: 0 },
          maxDataVal: 0,
        };
      }

      const minY = 12;
      const maxY = chartHeight - 12;
      const availableHeight = maxY - minY;
      const maxDataVal = activeTrend === "accuracy" ? 100 : Math.max(...data, 1);

      const today = new Date().getDay();
      const currentDayIndex = today === 0 ? 6 : today - 1;
      const currentWeekIndex = Math.min(
        Math.floor((new Date().getDate() - 1) / 7),
        3
      );

      const points = data.map((val: number, i: number) => {
        const normalizedVal =
          activeTrend === "accuracy"
            ? Math.min(100, Math.max(0, val))
            : (val / maxDataVal) * 100;

        let trendDidWorkout = false;
        if (
          activeTrend === "time" ||
          activeTrend === "workouts" ||
          activeTrend === "accuracy"
        ) {
          trendDidWorkout = displayStats.setsTrend
            ? displayStats.setsTrend[i] > 0
            : false;
        } else if (activeTrend === "pushups") {
          trendDidWorkout = displayStats.pushupTrend
            ? displayStats.pushupTrend[i] > 0
            : false;
        } else if (activeTrend === "squats") {
          trendDidWorkout = displayStats.squatTrend
            ? displayStats.squatTrend[i] > 0
            : false;
        } else if (activeTrend === "planks") {
          trendDidWorkout = displayStats.plankTrend
            ? displayStats.plankTrend[i] > 0
            : false;
        }

        return {
          x: 24 + i * ((screenWidth - 32) / Math.max(1, data.length - 1)),
          y: maxY - (normalizedVal / 100) * availableHeight,
          val: Math.round(val),
          label: displayStats.labels[i] || "",
          fullLabel:
            selectedRange === "week"
              ? [
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ][i]
              : selectedRange === "month"
              ? `Week ${i + 1}`
              : [
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ][i],
          isFuture:
            (selectedRange === "week" && i > currentDayIndex) ||
            (selectedRange === "month" && i > currentWeekIndex) ||
            (selectedRange === "year" && i > new Date().getMonth()),
          didWorkout: trendDidWorkout,
        };
      });

      const validPoints = points.filter((p: any) => !p.isFuture);
      let path =
        validPoints.length > 0
          ? `M ${validPoints[0].x} ${validPoints[0].y}`
          : "";
      for (let i = 0; i < validPoints.length - 1; i++) {
        const p0 = validPoints[i];
        const p1 = validPoints[i + 1];
        const cx = (p0.x + p1.x) / 2;
        path += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
      }
      return {
        path,
        points,
        lastPoint:
          validPoints.length > 0
            ? validPoints[validPoints.length - 1]
            : { x: 24, y: chartHeight },
        maxDataVal,
      };
    }, [
      displayStats,
      selectedRange,
      screenWidth,
      activeTrend,
      chartHeight,
    ]);

    const activePoint =
      selectedChartIndex !== null && curve.points[selectedChartIndex]
        ? curve.points[selectedChartIndex]
        : null;

    return (
      <View className="h-48 bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xs mb-6 overflow-hidden relative">
        {/* Chart Top Header & Tooltip */}
        <View className="h-6 flex-row justify-between items-center z-10 mb-2">
          <Text className="text-[10px] font-outfitReg text-white/50 uppercase tracking-wider">
            {getTrendTitle(activeTrend)} Trend ({displayStats.labelPrefix})
          </Text>

          {activePoint ? (
            <View className="bg-[#3A9E66] px-2.5 py-0.5 rounded-full flex-row items-center shadow-xs">
              <Text className="text-[10px] font-outfitBold text-[#141414]">
                {activeTrend === "time" || activeTrend === "planks"
                  ? formatTime(activePoint.val)
                  : `${activePoint.val}${
                      activeTrend === "accuracy"
                        ? "%"
                        : activeTrend === "workouts"
                        ? " sessions"
                        : " reps"
                    }`}{" "}
                • {activePoint.fullLabel}
              </Text>
            </View>
          ) : (
            <View className="h-5" />
          )}
        </View>

        {/* SVG Drawing Canvas */}
        <View className="w-full h-full pt-1 relative" style={{ width: screenWidth }}>
          {/* Y-Axis Labels Overlay */}
          <View
            className="absolute left-0 top-1 bottom-0 w-full z-0 pointer-events-none"
            style={{ height: chartHeight }}
          >
            <Text
              className="absolute left-0 text-[8px] font-outfitBold text-white/30"
              style={{ top: 12 - 5 }}
            >
              {activeTrend === "accuracy"
                ? "100"
                : Math.round(curve.maxDataVal || 0)}
            </Text>
            <Text
              className="absolute left-0 text-[8px] font-outfitBold text-white/30"
              style={{ top: chartHeight - 12 - 5 }}
            >
              0
            </Text>
          </View>

          <Svg
            width={screenWidth}
            height={chartHeight}
            viewBox={`0 0 ${screenWidth} ${chartHeight}`}
          >
            <Defs>
              <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#2F6B47" stopOpacity="0.22" />
                <Stop offset="100%" stopColor="#2F6B47" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>
            <Line
              x1="0"
              y1={chartHeight * 0.33}
              x2={screenWidth}
              y2={chartHeight * 0.33}
              stroke="#E8E5DF"
              strokeWidth="0.5"
              strokeDasharray="2 1"
            />
            <Line
              x1="0"
              y1={chartHeight * 0.66}
              x2={screenWidth}
              y2={chartHeight * 0.66}
              stroke="#E8E5DF"
              strokeWidth="0.5"
              strokeDasharray="2 1"
            />

            {curve.path ? (
              <>
                <Path
                  d={`${curve.path} L ${curve.lastPoint.x} ${chartHeight} L 24 ${chartHeight} Z`}
                  fill="url(#chartGrad)"
                />
                <Path
                  d={curve.path}
                  fill="none"
                  stroke="#2F6B47"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {curve.points.map((p: any, idx: number) => {
                  if (p.isFuture) return null;
                  const isSelected = selectedChartIndex === idx;
                  return (
                    <React.Fragment key={idx}>
                      {isSelected && (
                        <Line
                          x1={p.x}
                          y1={0}
                          x2={p.x}
                          y2={chartHeight}
                          stroke="#2F6B47"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                          opacity={0.7}
                        />
                      )}
                      <Circle
                        cx={p.x}
                        cy={p.y}
                        r={isSelected ? "4.5" : "3.5"}
                        fill={
                          p.val === 0 && !p.didWorkout ? "#EF4444" : "#2F6B47"
                        }
                        stroke="#FFFFFF"
                        strokeWidth={isSelected ? "2.5" : "1.8"}
                      />
                    </React.Fragment>
                  );
                })}
              </>
            ) : null}
          </Svg>

          {/* Interactive touch targets */}
          <View
            className="absolute inset-0 flex-row justify-between"
            style={{ height: chartHeight }}
          >
            {curve.points.map((_: any, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={{ flex: 1, height: chartHeight }}
                activeOpacity={1}
                onPress={() =>
                  onSelectChartIndex(
                    selectedChartIndex === idx ? null : idx
                  )
                }
              />
            ))}
          </View>
        </View>

        {/* X-Axis Horizontal Label Row */}
        <View
          className="absolute bottom-1 left-4"
          style={{ width: screenWidth, height: 20 }}
        >
          {curve.points.map((p: any, i: number) => (
            <TouchableOpacity
              key={i}
              style={{
                position: "absolute",
                left: p.x - 20,
                width: 40,
                alignItems: "center",
              }}
              activeOpacity={1}
              onPress={() =>
                onSelectChartIndex(selectedChartIndex === i ? null : i)
              }
            >
              <Text
                className={`text-[9px] font-outfitBold ${
                  selectedChartIndex === i
                    ? "text-[#3A9E66] text-[10px]"
                    : "text-white/50"
                }`}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
);

StatisticsTrendChart.displayName = "StatisticsTrendChart";
