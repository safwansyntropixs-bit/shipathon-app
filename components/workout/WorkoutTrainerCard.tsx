import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Edit2, Play } from 'lucide-react-native';
import { AnimatedSkeleton } from '../loaders/AnimatedSkeleton';

export interface WorkoutTrainerCardProps {
  exerciseKey: 'pushup' | 'squat' | 'plank';
  name: string;
  focus: string;
  targetText: string;
  delay?: number;
  onEditTarget: () => void;
  onStartSession: () => void;
}

export const WorkoutTrainerCard: React.FC<WorkoutTrainerCardProps> = React.memo(({
  exerciseKey,
  name,
  focus,
  targetText,
  delay = 80,
  onEditTarget,
  onStartSession
}) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(350)}
      className="p-4 flex-col bg-[#121212]/75 border border-[#3A9E66]/25 rounded-2xl overflow-hidden"
    >
      {/* Card Header */}
      <View className="flex-row justify-between items-center mb-3.5">
        <View className="flex-1 mr-3">
          <Text className="text-[19px] font-outfitBold text-white tracking-tight">
            {name}
          </Text>
          <Text className="text-[13px] font-outfitMed text-white/50 mt-1">
            Focus: <Text className="text-white/80">{focus}</Text>
          </Text>
        </View>
        <View className="w-[70px] h-[70px] rounded-2xl bg-black/40 border border-white/5 items-center justify-center">
          <AnimatedSkeleton exercise={exerciseKey} size={64} />
        </View>
      </View>

      {/* Card Footer Actions */}
      <View className="flex-row items-center justify-between pt-3 border-t border-white/5">
        {/* Target Pill */}
        <TouchableOpacity
          onPress={onEditTarget}
          activeOpacity={0.7}
          className="flex-row items-center justify-center gap-1.5 px-3.5 h-[38px] rounded-xl bg-white/5 border border-white/10"
        >
          <Text className="text-[11.5px] font-outfitMed text-white/50">Target:</Text>
          <Text className="text-[12.5px] font-outfitBold text-[#3A9E66]">{targetText}</Text>
          <Edit2 size={11} color="#3A9E66" />
        </TouchableOpacity>

        {/* Start Session Button */}
        <TouchableOpacity
          onPress={onStartSession}
          activeOpacity={0.8}
          className="flex-row items-center justify-center min-w-[136px] h-[38px] px-4 rounded-full bg-[#2F6B47] border border-[#3E8B5C] gap-2 shadow-xs"
        >
          <Text className="text-[12px] font-outfitBold text-white uppercase tracking-wider">
            Start Session
          </Text>
          <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});
