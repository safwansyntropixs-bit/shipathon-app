import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface PaginationControlProps {
  currentPage: number;
  hasMore: boolean;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({
  currentPage,
  hasMore,
  onNext,
  onPrev,
  isLoading = false
}) => {
  return (
    <Animated.View entering={FadeIn} className="flex-row items-center top-[-75px] justify-center py-2 mt-auto">
      <View className="flex-row items-center bg-white/5 border border-[#3A9E66]/30 rounded-full px-2 py-1.5 shadow-lg shadow-black/20">
        <TouchableOpacity
          onPress={onPrev}
          disabled={currentPage === 1 || isLoading}
          className={`p-2 border border-[#3A9E66]/30 rounded-full ${currentPage === 1 || isLoading ? 'opacity-30' : 'bg-white/10'}`}
        >
          <ChevronLeft size={16} color="#FFFFFF" />
        </TouchableOpacity>

        <View className="px-6 items-center justify-center min-w-[90px]">
          <Text className="font-outfitBold text-white text-[10px] tracking-widest uppercase">
            Page {currentPage}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onNext}
          disabled={!hasMore || isLoading}
          className={`p-2 border border-[#3A9E66]/30 rounded-full ${!hasMore || isLoading ? 'opacity-30' : 'bg-white/10'}`}
        >
          <ChevronRight size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
