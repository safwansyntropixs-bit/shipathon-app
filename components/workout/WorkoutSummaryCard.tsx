import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { CheckCircle, Info } from "lucide-react-native";

interface SummaryProps {
  summary: {
    exercise: string;
    reps: number;
    duration: string;
    poseTime?: string;
    accuracy: number;
    volume: string;
    calories: number;
  };
  onContinue: () => void;
  onConfirm: () => void;
}

export const WorkoutSummaryCard: React.FC<SummaryProps> = ({ summary, onContinue, onConfirm }) => {
  const isPlank = summary.exercise.toLowerCase().includes("plank");
  const isZeroScore = isPlank ? (summary.poseTime === "00:00") : (summary.reps === 0);

  return (
    <View className="absolute inset-0 z-50 flex-1 justify-center items-center bg-black/80 px-4">
      <View className="w-full max-w-md bg-brand-bgLight rounded-3xl overflow-hidden shadow-2xl">
        <ScrollView className="max-h-[85vh]" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 32 }}>
          {/* Celebration Header */}
          <View className="items-center mt-2 mb-6 space-y-3">
            <View className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isZeroScore ? "bg-brand-grey/10" : "bg-brand-forest/10"}`}>
              {isZeroScore ? (
                <Info size={40} color="#6B7280" />
              ) : (
                <CheckCircle size={40} color="#2F6B47" />
              )}
            </View>
            <View className="items-center">
              <Text className="text-2xl font-outfitBold tracking-tight text-brand-charcoal text-center">
                {isZeroScore ? "Workout Paused" : "Great Progress!"}
              </Text>
              <Text className="text-xs font-outfitReg text-brand-grey mt-1 text-center">
                {isZeroScore 
                  ? "No measurable activity recorded yet." 
                  : "Review your metrics before finishing."}
              </Text>
            </View>
          </View>

          {/* Accuracy Metric Box */}
          {isZeroScore ? (
            <View className="bg-brand-bgSand border border-brand-divider p-4 rounded-xl items-center mb-6 flex-row gap-3">
              <View className="bg-brand-grey/10 w-12 h-12 rounded-full items-center justify-center border border-brand-grey/20">
                <Text className="text-sm font-outfitBold text-brand-grey">N/A</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-outfitMed uppercase tracking-widest text-brand-grey mb-0.5">Accuracy Rating</Text>
                <Text className="text-[11px] font-outfitReg text-brand-charcoal/80 leading-tight pr-2">
                  Accuracy cannot be measured. No valid {isPlank ? "stabilized time" : "reps"} recorded.
                </Text>
              </View>
            </View>
          ) : (
            <View className="bg-brand-forest p-6 rounded-2xl items-center relative overflow-hidden mb-6">
              <View className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8"></View>
              <Text className="text-[10px] font-outfitMed uppercase tracking-widest text-brand-sage mb-1">Accuracy Rating</Text>
              <Text className="text-4xl font-outfitBold tracking-tight text-brand-card">{summary.accuracy}%</Text>
              <Text className="text-xs font-outfitReg text-brand-bgSand/80 mt-2 text-center max-w-[180px]">
                Consistent pacing with elite biomechanical alignment.
              </Text>
            </View>
          )}

          {/* Details list */}
          <View className="mb-8 gap-3">
            <Text className="text-xs font-outfitMed uppercase tracking-wider text-brand-grey mb-1">Metrics Summary</Text>
            
            <View className="bg-brand-card border border-brand-divider rounded-xl p-4 flex-row justify-between items-center">
              <Text className="text-xs font-outfitMed uppercase text-brand-grey">Exercise</Text>
              <Text className="text-sm font-outfitBold text-brand-charcoal">{summary.exercise}</Text>
            </View>

            {!summary.exercise.toLowerCase().includes("plank") && (
              <View className="bg-brand-card border border-brand-divider rounded-xl p-4 flex-row justify-between items-center">
                <Text className="text-xs font-outfitMed uppercase text-brand-grey">Total Reps</Text>
                <Text className="text-sm font-outfitBold text-brand-charcoal">{summary.reps} reps</Text>
              </View>
            )}

            <View className="bg-brand-card border border-brand-divider rounded-xl p-4 flex-row justify-between items-center">
              <Text className="text-xs font-outfitMed uppercase text-brand-grey">Active Duration</Text>
              <Text className="text-sm font-outfitBold text-brand-charcoal">{summary.duration}</Text>
            </View>

            {summary.exercise.toLowerCase().includes("plank") && summary.poseTime && (
              <View className="bg-brand-card border border-brand-divider rounded-xl p-4 flex-row justify-between items-center">
                <Text className="text-xs font-outfitMed uppercase text-brand-grey">Stabilized Time</Text>
                <Text className="text-sm font-outfitBold text-brand-charcoal">{summary.poseTime}</Text>
              </View>
            )}

            <View className="bg-brand-card border border-brand-divider rounded-xl p-4 flex-row justify-between items-center">
              <Text className="text-xs font-outfitMed uppercase text-brand-grey">Estimated Volume</Text>
              <Text className="text-sm font-outfitBold text-brand-charcoal">{summary.volume}</Text>
            </View>

            <View className="bg-brand-card border border-brand-divider rounded-xl p-4 flex-row justify-between items-center">
              <Text className="text-xs font-outfitMed uppercase text-brand-grey">Calories Burned</Text>
              <Text className="text-sm font-outfitBold text-brand-charcoal">{summary.calories} kcal</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <TouchableOpacity
              onPress={onConfirm}
              className="w-full h-12 bg-brand-forest rounded-xl items-center justify-center"
            >
              <Text className="text-brand-card font-outfitBold text-sm">Confirm Finish Workout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onContinue}
              className="w-full h-12 bg-brand-bgSand border border-brand-divider rounded-xl items-center justify-center"
            >
              <Text className="text-brand-charcoal text-xs font-outfitMed uppercase tracking-wider">Continue Workout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};
