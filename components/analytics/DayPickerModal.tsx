import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import React, { useMemo } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { ModalTopBorder } from "../ui/ModalTopBorder";

interface DayPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const DayPickerModal: React.FC<DayPickerModalProps> = ({
  visible,
  onClose,
  selectedDate,
  selectedDay,
  onSelectDay,
}) => {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const monthName = MONTH_NAMES[month];

  const now = new Date();
  const isCurrentMonthAndYear =
    now.getFullYear() === year && now.getMonth() === month;
  const currentDayNumber = now.getDate();

  const { daysInMonth, firstDayOfWeekOffset } = useMemo(() => {
    const days = new Date(year, month + 1, 0).getDate();
    const offset = new Date(year, month, 1).getDay(); // 0 = Sunday
    return { daysInMonth: days, firstDayOfWeekOffset: offset };
  }, [year, month]);

  const handleSelectDay = (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    if (selectedDay === day) {
      onSelectDay(null); // Deselect if already selected
    } else {
      onSelectDay(day);
    }
    onClose();
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    onSelectDay(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/75 items-center justify-center p-6"
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-sm bg-[#18181B] rounded-3xl p-5 border border-white/5 shadow-2xl overflow-hidden relative"
          onPress={(e) => e.stopPropagation()}
        >
          <ModalTopBorder theme="emerald" />
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-white/10 z-10">
            <View className="flex-row items-center">
              <View>
                <Text className="text-sm font-outfitBold text-white uppercase tracking-wider">
                  {monthName} {year}
                </Text>
                <Text className="text-[11px] font-outfitReg text-white/50">
                  Select a day to filter workouts
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-white/5 items-center justify-center active:bg-white/10"
            >
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Weekday Row */}
          <View className="flex-row w-full mb-2">
            {WEEKDAY_NAMES.map((weekday, idx) => (
              <View key={idx} style={{ width: "14.2857%" }} className="items-center justify-center">
                <Text className="text-[10px] font-outfitBold uppercase text-white/40">
                  {weekday}
                </Text>
              </View>
            ))}
          </View>

          {/* Days Grid */}
          <View className="flex-row flex-wrap w-full">
            {/* Empty slots before day 1 */}
            {Array.from({ length: firstDayOfWeekOffset }).map((_, i) => (
              <View key={`empty-${i}`} style={{ width: "14.2857%" }} className="h-10 items-center justify-center" />
            ))}

            {/* Days 1 to daysInMonth */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = selectedDay === day;
              const isFuture = isCurrentMonthAndYear && day > currentDayNumber;
              const isToday = isCurrentMonthAndYear && day === currentDayNumber;

              return (
                <View key={day} style={{ width: "14.2857%" }} className="h-10 items-center justify-center mb-1">
                  <TouchableOpacity
                    disabled={isFuture}
                    onPress={() => handleSelectDay(day)}
                    activeOpacity={0.7}
                    className={`w-9 h-9 rounded-xl items-center justify-center border ${isSelected
                      ? "bg-[#3A9E66] border-[#3A9E66] shadow-sm"
                      : isToday
                        ? "bg-white/10 border-[#3A9E66]/50"
                        : isFuture
                          ? "bg-transparent border-transparent opacity-20"
                          : "bg-white/5 border-white/5 active:bg-white/10"
                      }`}
                  >
                    <Text
                      className={`text-xs ${isSelected
                        ? "font-outfitBold text-white"
                        : isToday
                          ? "font-outfitBold text-[#3A9E66]"
                          : isFuture
                            ? "font-outfitReg text-white/30"
                            : "font-outfitMed text-white/80"
                        }`}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
