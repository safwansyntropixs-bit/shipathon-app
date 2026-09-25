import React from "react";
import { Text, View } from "react-native";
import { PersonalRecords } from "@/services/workout/historyService";
import { SkeletonBlock } from "@/components/loaders/SkeletonLoader";
import { formatPlankTime } from "@/utils/analyticsFormatters";

interface PersonalRecordsBannerProps {
  personalRecords: PersonalRecords | null;
  hasError?: boolean;
}

export const PersonalRecordsBanner = React.memo<PersonalRecordsBannerProps>(
  ({ personalRecords, hasError = false }) => {
    if (hasError) return null;

    return (
      <View className="px-6 z-10">
        <View className="mt-1 h-[70px] mb-2 bg-white/5 border items-center border-[#3A9E66]/30 rounded-2xl p-4 flex-row justify-around shadow-sm">
          {/* Max Pushups */}
          <View className="items-center">
            <Text className="text-xs font-outfitReg text-white/50 uppercase tracking-wide mt-[-7px]">
              Max Pushups
            </Text>
            {personalRecords ? (
              <Text className="text-xl font-outfitBold text-white">
                {personalRecords.maxPushups}
              </Text>
            ) : (
              <SkeletonBlock
                width={40}
                height={24}
                borderRadius={6}
                className="mt-1"
              />
            )}
          </View>

          <View className="w-px bg-white/10 my-1" />

          {/* Max Squats */}
          <View className="items-center">
            <Text className="text-xs font-outfitReg text-white/50 uppercase tracking-wide mt-[-7px]">
              Max Squats
            </Text>
            {personalRecords ? (
              <Text className="text-xl font-outfitBold text-white">
                {personalRecords.maxSquats}
              </Text>
            ) : (
              <SkeletonBlock
                width={40}
                height={24}
                borderRadius={6}
                className="mt-1"
              />
            )}
          </View>

          <View className="w-px bg-white/10 my-1" />

          {/* Max Plank */}
          <View className="items-center">
            <Text className="text-xs font-outfitReg text-white/50 uppercase tracking-wide mt-[-7px]">
              Max Plank
            </Text>
            {personalRecords ? (
              <Text className="text-xl font-outfitBold text-white">
                {formatPlankTime(personalRecords.maxPlankTime)}
              </Text>
            ) : (
              <SkeletonBlock
                width={40}
                height={24}
                borderRadius={6}
                className="mt-1"
              />
            )}
          </View>
        </View>
      </View>
    );
  }
);

PersonalRecordsBanner.displayName = "PersonalRecordsBanner";
