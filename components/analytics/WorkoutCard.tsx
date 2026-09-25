import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { Cloud, AlertCircle } from "lucide-react-native";
import { HistoryItem } from "../../services/workout/historyService";
import { syncQueueService } from "../../services/core/syncQueueService";

interface WorkoutCardProps {
  item: HistoryItem;
  isExpanded?: boolean;
  onToggle?: (id: string) => void;
  onRetrySync?: (id: string) => void;
}

export const WorkoutCard = React.memo(({
  item,
  isExpanded = false,
  onToggle,
  onRetrySync,
}: WorkoutCardProps) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const isPlank = item.exercise.toLowerCase().includes("plank");
  const isPending = item.syncStatus === "pending" || item.syncStatus === "syncing";
  const isError = item.syncStatus === "dead_letter" || item.syncStatus === "error";

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      if (onRetrySync) {
        onRetrySync(item.id);
      } else {
        await syncQueueService.retryDeadLetterItem(item.id);
      }
    } catch (err) {
      console.error("[WorkoutCard] Retry sync failed:", err);
    } finally {
      setIsRetrying(false);
    }
  };

  const formattedPlankTime = () => {
    const totalSecs = item.plankSeconds || 0;
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    if (m > 0 && s > 0) return `${m}m ${s}s`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  };

  return (
    <Animated.View
      layout={LinearTransition.duration(250)}
      style={{ marginBottom: 12 }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (onToggle) {
            onToggle(item.id);
          }
        }}
      >
        <View className={`bg-white/5 rounded-2xl p-4 shadow-sm border ${
          isError 
            ? "border-red-500/40 bg-red-500/[0.03]" 
            : isPending 
            ? "border-amber-400/30 bg-amber-400/[0.02]" 
            : "border-[#3A9E66]/30"
        }`}>
          <View className="flex-row justify-between items-center">
            <View className="flex-1 mr-3">
              <View className="flex-row items-center flex-wrap mb-1.5">
                <Text className="text-sm font-outfitBold text-white mr-2">{item.exercise}</Text>
                
                <View className="bg-[#3A9E66]/20 px-2 py-0.5 rounded-full mr-1.5">
                  <Text className="text-[10px] font-outfitMed text-[#3A9E66]">{item.accuracy}% Accuracy</Text>
                </View>

                {/* Optimistic / Sync Status Badges */}
                {isPending && (
                  <View className="flex-row items-center bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                    <Cloud size={10} color="#FBBF24" />
                    <Text className="text-[10px] font-outfitMed text-amber-300 ml-1">
                      {item.syncStatus === "syncing" ? "Syncing..." : "Pending"}
                    </Text>
                  </View>
                )}

                {isError && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRetry();
                    }}
                    className="flex-row items-center bg-red-500/15 px-2 py-0.5 rounded-full border border-red-500/40"
                  >
                    {isRetrying ? (
                      <ActivityIndicator size="small" color="#EF4444" style={{ transform: [{ scale: 0.6 }] }} />
                    ) : (
                      <AlertCircle size={10} color="#EF4444" />
                    )}
                    <Text className="text-[10px] font-outfitBold text-red-400 ml-1">
                      {isRetrying ? "Retrying..." : "Sync Error · Tap to Retry"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="flex-row items-center">
                <Text className="text-xs font-outfitReg text-white/50">{item.date}</Text>
              </View>
            </View>

            <View className="items-end">
              {isPlank ? (
                <>
                  <Text className="text-base font-outfitBold text-white">
                    {formattedPlankTime()}
                  </Text>
                  <Text className="text-[10px] font-outfitReg text-white/50 uppercase">{item.duration}</Text>
                </>
              ) : (
                <>
                  <Text className="text-base font-outfitBold text-white">
                    {item.reps} {item.reps === 1 ? "Set" : "Reps"}
                  </Text>
                  <Text className="text-[10px] font-outfitReg text-white/50 uppercase">{item.duration}</Text>
                </>
              )}
            </View>
          </View>

          {isExpanded && (
            <Animated.View
              entering={FadeInDown.duration(250)}
              exiting={FadeOutUp.duration(150)}
              className="mt-4 pt-4 border-t border-[#3A9E66]/30 flex-row justify-between"
            >
              <View>
                <Text className="text-[10px] font-outfitReg text-white/50 uppercase">
                  {isPlank ? "Endurance" : "Pace"}
                </Text>
                <Text className="text-sm font-outfitMed text-white">{item.volume || "-"}</Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] font-outfitReg text-white/50 uppercase">Est. Calories</Text>
                <Text className="text-sm font-outfitMed text-white">{item.calories || 0} kcal</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

WorkoutCard.displayName = "WorkoutCard";
