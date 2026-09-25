import * as Haptics from "expo-haptics";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ProVisibilityGate } from "../ui/ProVisibilityGate";

interface MonthSwitcherProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenCalendar: () => void;
  isNextDisabled?: boolean;
  isCalendarDisabled?: boolean;
  selectedDay?: number | null;
  onClearDayFilter?: () => void;
  isLocked?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MonthSwitcher = React.memo(({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onOpenCalendar,
  isNextDisabled = false,
  isCalendarDisabled = false,
  selectedDay = null,
  onClearDayFilter,
  isLocked = false,
}: MonthSwitcherProps) => {
  const monthName = MONTH_NAMES[currentDate.getMonth()];
  const year = currentDate.getFullYear();
  const formattedHeader = `${monthName} ${year}`;

  const handlePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    onPrevMonth();
  };

  const handleNext = () => {
    if (isNextDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    onNextMonth();
  };

  const handleCalendar = () => {
    if (isCalendarDisabled) return;
    onOpenCalendar();
  };

  const handleClearDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    if (onClearDayFilter) onClearDayFilter();
  };

  return (
    <View className="w-full mb-3">
      <View className="flex-row items-center justify-between py-2">
        {/* Previous Month Arrow */}
        <TouchableOpacity
          onPress={handlePrev}
          activeOpacity={0.7}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 items-center justify-center active:bg-white/10 relative"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color={isLocked ? "rgba(255,255,255,0.2)" : "#FFFFFF"} />
          <ProVisibilityGate
            className="absolute -top-1 -right-1"
            lockIconSize={10}
            lockIconColor="#F0B35C"
          />
        </TouchableOpacity>

        {/* Current Month Title */}
        <View className="flex-1 items-center justify-center px-2">
          <Text className="text-sm font-outfitBold text-white tracking-wide uppercase">
            {formattedHeader}
          </Text>
        </View>

        {/* Next Month Arrow */}
        <TouchableOpacity
          onPress={handleNext}
          disabled={isNextDisabled}
          activeOpacity={0.7}
          className={`w-9 h-9 rounded-xl bg-white/5 border border-white/5 items-center justify-center active:bg-white/10 mr-2 ${isNextDisabled ? "opacity-50" : "opacity-100"
            }`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronRight size={18} color={isNextDisabled ? "rgba(255,255,255,0.5)" : "#FFFFFF"} />
        </TouchableOpacity>

        {/* Calendar Day Picker Icon */}
        <TouchableOpacity
          onPress={handleCalendar}
          disabled={isCalendarDisabled}
          activeOpacity={0.7}
          className={`w-9 h-9 rounded-xl items-center justify-center border relative ${isCalendarDisabled
              ? "bg-white/5 border-white/5 opacity-40"
              : selectedDay !== null
                ? "bg-[#3A9E66]/20 border-[#3A9E66]/50"
                : "bg-white/5 border-white/5 active:bg-white/10"
            }`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Calendar
            size={18}
            color={
              isCalendarDisabled
                ? "rgba(255,255,255,0.3)"
                : selectedDay !== null
                  ? "#3A9E66"
                  : "#FFFFFF"
            }
          />
          {selectedDay !== null && !isCalendarDisabled && (
            <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#3A9E66]" />
          )}
        </TouchableOpacity>
      </View>

      {/* Selected Day Filter Chip */}
      {selectedDay !== null && (
        <View className="flex-row items-center justify-between bg-[#3A9E66]/10 border border-[#3A9E66]/30 rounded-xl px-3 py-1.5 mt-2">
          <Text className="text-xs font-outfitMed text-[#3A9E66]">
            Filtered: {monthName.slice(0, 3)} {selectedDay}, {year}
          </Text>
          <TouchableOpacity
            onPress={handleClearDay}
            className="flex-row items-center bg-[#3A9E66]/20 px-2 py-0.5 rounded-lg active:bg-[#3A9E66]/30"
          >
            <Text className="text-[10px] font-outfitBold text-white mr-1 uppercase">Clear</Text>
            <X size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

MonthSwitcher.displayName = "MonthSwitcher";
