import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { Check, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { XPToast, XPToastTheme } from "../../components/ui/XPToast";
import { TROPHY_DETAILS } from "../../constants/gamification";
import { QUESTS, useAchievementStore } from "../../store/gamification/achievementStore";
import { useAuthStore } from "../../store/user/authStore";
import { useDashboardStore } from "../../store/workout/dashboardStore";
import { useTrophyStore } from "../../store/gamification/trophyStore";
import { useWorkoutStore } from "../../store/workout/workoutStore";

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const summary = useWorkoutStore((state) => state.lastWorkoutSummary);
  const endWorkout = useWorkoutStore((state) => state.endWorkout);
  const user = useAuthStore((state) => state.user);
  const { claimQuest, loadCompletedQuests } = useAchievementStore();
  const { unlockTrophy } = useTrophyStore();

  interface ToastData {
    id: string;
    title: string;
    subtitle: string;
    xpAmount: number;
    iconName?: string;
    theme: XPToastTheme;
    imageSource?: any;
    accentColor?: string;
  }

  const [isLoading, setIsLoading] = useState(true);
  const [toastQueue, setToastQueue] = useState<ToastData[]>([]);

  useEffect(() => {
    // 1. Instantly enforce Portrait Mode to avoid ghost landscape UI
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);

    const activeUserId = user?.id || useAuthStore.getState().user?.id || "local-user";

    const initializeSummary = async () => {
      try {
        // Fetch the absolute latest metrics & dashboard stats so we can accurately check if a quest was just crossed
        await Promise.all([
          loadCompletedQuests(activeUserId),
          useDashboardStore.getState().loadDashboardData(activeUserId, true)
        ]);
      } catch (e) {
        console.error("Error loading summary stats", e);
      }

      // 2. Simulate brief tallying while speech plays out seamlessly
      setTimeout(() => {
        setIsLoading(false);

        // 4. Quietly check for completed quests, streak bonus, and newly unlocked trophies
        const newToasts: ToastData[] = [];

        // 4a. Evaluate Trophies first
        if (summary) {
          const currentUnlocked = useTrophyStore.getState().unlockedTrophies;
          const checkAndQueueTrophy = (id: string) => {
            if (!currentUnlocked.some(t => t.id === id)) {
              unlockTrophy(activeUserId, id);
              const tDetails = TROPHY_DETAILS[id];
              if (tDetails) {
                newToasts.push({
                  id: tDetails.id,
                  title: tDetails.title,
                  subtitle: 'Trophy Unlocked',
                  xpAmount: 0,
                  theme: 'trophy',
                  imageSource: tDetails.image,
                  accentColor: tDetails.accentColor
                });
              }
            }
          };

          const ex = (summary.exercise || "").toLowerCase();
          // The Juggernaut
          if ((ex.includes("pushup") || ex.includes("push-up") || ex.includes("push up")) && summary.reps >= 100 && summary.durationSeconds <= 540) {
            checkAndQueueTrophy("the_juggernaut");
          }
          // The Statue
          if (ex.includes("plank") && summary.validSeconds >= 300 && summary.durationSeconds <= 450) {
            checkAndQueueTrophy("the_statue");
          }
          // The Surgeon
          if (summary.reps >= 50 && summary.accuracy >= 95) {
            checkAndQueueTrophy("the_surgeon");
          }
        }

        // 4b. Evaluate Quests with live store state
        const currentCompleted = useAchievementStore.getState().completedQuests;

        QUESTS.forEach((quest) => {
          if (!currentCompleted.includes(quest.id)) {
            const currentProgress = useAchievementStore.getState().calculateProgress(quest);

            if (currentProgress >= quest.target) {
              claimQuest(activeUserId, quest.id);
              newToasts.push({
                id: quest.id,
                title: quest.title,
                subtitle: 'Quest Completed',
                xpAmount: quest.xpReward,
                iconName: quest.icon,
                theme: 'default'
              });
            }
          }
        });

        if (summary?.streakBonusXp && summary.streakBonusXp > 0) {
          newToasts.push({
            id: 'streak_bonus',
            title: `${summary.streakDays || 1}-Day Streak Bonus`,
            subtitle: 'Milestone Reached!',
            xpAmount: summary.streakBonusXp,
            iconName: 'Flame',
            theme: 'warning'
          });
        }

        if (newToasts.length > 0) {
          setToastQueue(newToasts);
        }
      }, 1500);
    };

    initializeSummary();
  }, [user?.id, summary]);

  if (!summary) {
    return (
      <View className="flex-1 bg-[#121212] items-center justify-center px-6">
        <Text className="text-white font-outfitBold text-xl mb-4 text-center">
          Workout session ended unexpectedly.
        </Text>
        <TouchableOpacity
          onPress={() => {
            endWorkout();
            router.replace("/(tabs)/workouts");
          }}
          className="bg-brand-forest px-8 py-4 rounded-full flex-row items-center gap-2"
        >
          <Text className="text-white font-outfitBold">Return Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPlank = summary.exercise.toLowerCase().includes("plank");
  const isFailed = summary.isEndedEarly;

  // Calculate local Base XP (1:1 with Target for Reps, 4:1 for Plank)
  let baseXp = 0;
  if (isPlank) {
    baseXp = summary.validSeconds / 4.0;
  } else {
    baseXp = summary.reps;
  }

  // Calculate Final XP identically to the database trigger
  const finalXp = Math.round(baseXp * summary.xpMultiplier);

  if (isLoading) {
    return (
      <LinearGradient colors={["#121212", "#0A1F13"]} className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color="#A7C4B5" className="mb-6" />
        <Text className="text-brand-sage font-outfitMed text-sm uppercase tracking-widest animate-pulse">
          Tallying Results...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={isFailed ? ["#1E1212", "#121212"] : ["#0A1F13", "#121212"]} className="flex-1 px-6 pt-10 pb-6 relative">
      {/* Structural non-scrollable container */}
      <View className="flex-1 justify-center mt-4">

        {/* Header Section */}
        <View className={`items-center mt-4 ${isFailed ? 'mb-4' : 'mb-8'}`}>
          <View className={`w-20 h-20 rounded-full items-center justify-center border-2 ${isFailed ? "mb-4 bg-red-500/15 border-red-500/30" : "mb-6 bg-[#3A9E66]/15 border-[#3A9E66]/40"}`}>
            {isFailed ? (
              <X size={38} color="#EF4444" strokeWidth={2.5} />
            ) : (
              <Check size={38} color="#4ADE80" strokeWidth={2.5} />
            )}
          </View>
          <Text className={`font-outfitBold tracking-tight text-white text-center mb-2 ${isFailed ? 'text-3xl' : 'text-4xl'}`}>
            {isFailed ? "Session Interrupted" : "Great Progress!"}
          </Text>
          <Text className={`font-outfitReg text-center px-4 ${isFailed ? "text-base text-red-400" : "text-lg text-brand-sage"}`}>
            {isFailed
              ? "You ended the session early or time expired."
              : "Workout completed successfully. Excellent form!"}
          </Text>
        </View>

        {/* XP Glassmorphic Banner */}
        <View className={`rounded-3xl items-center border backdrop-blur-md ${isFailed ? "p-4 mb-4 bg-red-500/5 border-red-500/10" : "p-6 mb-6 bg-white/5 border-white/10 shadow-lg"}`}>
          <View className="flex-row items-center gap-2 mb-2">
            <Text className={`font-outfitMed uppercase tracking-widest ${isFailed ? "text-xs text-red-400" : "text-sm text-brand-sage"}`}>
              Total XP Earned
            </Text>
          </View>
          <Text className={`font-outfitBold tracking-tighter ${isFailed ? "text-5xl text-red-500" : "text-6xl text-white"}`}>
            {finalXp}
          </Text>
        </View>

        {/* Physical Effort Disclaimer for Failed State */}
        {isFailed && (
          <View className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
            <Text className="text-xs font-outfitReg text-brand-grey text-center leading-relaxed">
              You exited early, but your raw physical effort ({isPlank ? summary.durationSeconds + 's' : (summary.reps || summary.validSeconds) + ' reps'}) was still saved. A 0.7x XP penalty was applied.
            </Text>
          </View>
        )}

        {/* Metrics Grid */}
        <View className="mb-4 bg-white/5 rounded-3xl border border-white/10 overflow-hidden shadow-lg">
          <View className="p-5 flex-row justify-between items-center border-b border-white/5">
            <View className="flex-row items-center gap-3">
              <Text className="text-sm font-outfitMed text-brand-grey">Exercise</Text>
            </View>
            <Text className="text-base font-outfitBold text-white capitalize">{summary.exercise}</Text>
          </View>

          <View className="p-5 flex-row justify-between items-center border-b border-white/5">
            <View className="flex-row items-center gap-3">
              <Text className="text-sm font-outfitMed text-brand-grey">
                {isPlank ? "Valid Stabilized Time" : "Valid Reps"}
              </Text>
            </View>
            <Text className="text-base font-outfitBold text-white">
              {isPlank ? `${summary.validSeconds}s` : summary.reps}
            </Text>
          </View>

          <View className="p-5 flex-row justify-between items-center border-b border-white/5">
            <View className="flex-row items-center gap-3">
              <Text className="text-sm font-outfitMed text-brand-grey">Total Duration</Text>
            </View>
            <Text className="text-base font-outfitBold text-white">{summary.duration}</Text>
          </View>

          <View className="p-5 flex-row justify-between items-center">
            <View className="flex-row items-center gap-3">
              <Text className="text-sm font-outfitMed text-brand-grey">Form Accuracy</Text>
            </View>
            <Text className={`text-base font-outfitBold ${summary.accuracy >= 85 ? "text-brand-success" : "text-orange-400"}`}>
              {summary.accuracy}%
            </Text>
          </View>
        </View>

      </View>

      {/* Action Button */}
      <View className="mt-auto">
        <TouchableOpacity
          onPress={() => {
            endWorkout();
            router.replace("/(tabs)/workouts");
          }}
          className="w-full h-16 bg-[#2F6B47] rounded-full flex-row items-center justify-center border border-[#3E8B5C]"
        >
          <Text className="text-white font-outfitBold text-base tracking-wide">{isFailed ? "DONE" : "LOCK IT IN"}</Text>
        </TouchableOpacity>
      </View>

      {/* Render Animated XP Toasts */}
      {toastQueue.map((toast, index) => (
        <XPToast
          key={toast.id}
          title={toast.title}
          subtitle={toast.subtitle}
          xpAmount={toast.xpAmount}
          iconName={toast.iconName}
          theme={toast.theme}
          imageSource={toast.imageSource}
          accentColor={toast.accentColor}
          index={index}
          onComplete={() => {
            setToastQueue((prev) => prev.filter((t) => t.id !== toast.id));
          }}
        />
      ))}
    </LinearGradient>
  );
}
