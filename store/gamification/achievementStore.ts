import { supabase } from "@/utils/supabase";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useDashboardStore } from "../workout/dashboardStore";
import { useProfileStore } from "../user/profileStore";
import { Achievement, QUESTS, calculateLevelFromXp } from "../../constants/gamification";
import { mmkvStorage } from "@/services/core/storageService";

export * from "../../constants/gamification";

export interface QuestMetrics {
  dailyPushups: number;
  dailySquats: number;
  dailyPlankSeconds: number;
  weeklyPushups: number;
  weeklySquats: number;
  weeklyPlankSeconds: number;
  monthlyPushups: number;
  monthlySquats: number;
  monthlyPlankSeconds: number;
}

const isPushupExercise = (type?: string) => {
  const t = (type || "").toLowerCase().replace(/[-_\s]/g, "");
  return t.includes("pushup") || t.includes("push");
};

const isSquatExercise = (type?: string) => {
  const t = (type || "").toLowerCase().replace(/[-_\s]/g, "");
  return t.includes("squat");
};

const isPlankExercise = (type?: string) => {
  const t = (type || "").toLowerCase().replace(/[-_\s]/g, "");
  return t.includes("plank");
};

export const getQuestBoundaries = () => {
  const now = new Date();
  
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  
  return { startOfDay, startOfWeek, startOfMonth };
};

/**
 * Computes date-bounded quest metrics from local history store cache.
 * Provides resilient, offline calculation for daily, weekly, and monthly quests.
 */
export const computeMetricsFromHistory = (historyItems: any[], includePending = false): QuestMetrics => {
  const boundaries = getQuestBoundaries();
  const metrics: QuestMetrics = {
    dailyPushups: 0, dailySquats: 0, dailyPlankSeconds: 0,
    weeklyPushups: 0, weeklySquats: 0, weeklyPlankSeconds: 0,
    monthlyPushups: 0, monthlySquats: 0, monthlyPlankSeconds: 0,
  };

  if (!historyItems || historyItems.length === 0) return metrics;

  for (const item of historyItems) {
    // Under Server-Authoritative architecture:
    // Offline/pending workouts do NOT update stats until synced.
    if (!includePending && item.syncStatus === 'pending') continue;

    const t = item.timestamp || (item.date ? new Date(item.date).getTime() : 0);
    if (!t || isNaN(t)) continue;

    const reps = item.reps || 0;
    const secs = item.plankSeconds || 0;
    const isPushup = isPushupExercise(item.exercise);
    const isSquat = isSquatExercise(item.exercise);
    const isPlank = isPlankExercise(item.exercise);

    if (t >= boundaries.startOfDay.getTime()) {
      if (isPushup) metrics.dailyPushups += reps;
      if (isSquat) metrics.dailySquats += reps;
      if (isPlank) metrics.dailyPlankSeconds += secs;
    }
    if (t >= boundaries.startOfWeek.getTime()) {
      if (isPushup) metrics.weeklyPushups += reps;
      if (isSquat) metrics.weeklySquats += reps;
      if (isPlank) metrics.weeklyPlankSeconds += secs;
    }
    if (t >= boundaries.startOfMonth.getTime()) {
      if (isPushup) metrics.monthlyPushups += reps;
      if (isSquat) metrics.monthlySquats += reps;
      if (isPlank) metrics.monthlyPlankSeconds += secs;
    }
  }

  return metrics;
};

export const getRawMetricForQuest = (
  questId: string,
  metrics: QuestMetrics | null,
  dashboardData?: { todaySquatReps?: number; todayPushupReps?: number; todayPlankTimeMin?: number } | null
): number => {
  switch (questId) {
    // Daily quests: max of dashboard aggregated today data and raw metrics
    case "morning_routine":
      return Math.max(metrics?.dailySquats || 0, dashboardData?.todaySquatReps || 0);
    case "quick_pump":
      return Math.max(metrics?.dailyPushups || 0, dashboardData?.todayPushupReps || 0);
    case "core_activation":
      return Math.max(metrics?.dailyPlankSeconds || 0, Math.round((dashboardData?.todayPlankTimeMin || 0) * 60));

    // Weekly quests: STRICTLY weekly metrics (never fallback to all-time dashboard totals)
    case "leg_day_burn":
      return metrics?.weeklySquats || 0;
    case "chest_builder":
      return metrics?.weeklyPushups || 0;
    case "iron_core":
      return metrics?.weeklyPlankSeconds || 0;

    // Monthly quests: STRICTLY monthly metrics (never fallback to all-time dashboard totals)
    case "squat_mastery":
      return metrics?.monthlySquats || 0;
    case "pushup_spartan":
      return metrics?.monthlyPushups || 0;
    case "titan_hold":
      return metrics?.monthlyPlankSeconds || 0;

    default:
      return 0;
  }
};

interface AchievementState {
  completedQuests: string[];
  questMetrics: QuestMetrics | null;
  isLoading: boolean;
  isLoaded: boolean;
  loadCompletedQuests: (userId: string) => Promise<void>;
  claimQuest: (userId: string, questId: string) => Promise<void>;
  calculateProgress: (quest: Achievement) => number;
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      completedQuests: [],
      questMetrics: null,
      isLoading: false,
      isLoaded: false,

      loadCompletedQuests: async (userId: string) => {
        const hasCached = get().isLoaded;
        if (!hasCached) {
          set({ isLoading: true });
        }
        try {
          const boundaries = getQuestBoundaries();
          const fetchStart = new Date(Math.min(boundaries.startOfWeek.getTime(), boundaries.startOfMonth.getTime()));

          let metrics: QuestMetrics = {
            dailyPushups: 0, dailySquats: 0, dailyPlankSeconds: 0,
            weeklyPushups: 0, weeklySquats: 0, weeklyPlankSeconds: 0,
            monthlyPushups: 0, monthlySquats: 0, monthlyPlankSeconds: 0,
          };

          let validCompleted: string[] = get().completedQuests || [];

          if (userId && userId !== "local-user") {
            try {
              const [{ data: achievements, error: achError }, { data: workouts, error: workError }] = await Promise.all([
                supabase
                  .from("user_achievements")
                  .select("achievement_id, type, created_at")
                  .eq("user_id", userId),
                supabase
                  .from("workouts")
                  .select("id, exercise_type, valid_rep_count, valid_active_seconds, created_at")
                  .eq("user_id", userId)
                  .gte("created_at", fetchStart.toISOString())
              ]);

              if (achError) console.warn("[loadCompletedQuests] error fetching achievements:", achError);
              if (workError) console.warn("[loadCompletedQuests] error fetching workouts:", workError);

              if (workouts && workouts.length > 0) {
                for (const w of workouts) {
                  const t = new Date(w.created_at).getTime();
                  const reps = w.valid_rep_count || 0;
                  const secs = w.valid_active_seconds || 0;
                  const isPushup = isPushupExercise(w.exercise_type);
                  const isSquat = isSquatExercise(w.exercise_type);
                  const isPlank = isPlankExercise(w.exercise_type);
                  
                  if (t >= boundaries.startOfDay.getTime()) {
                    if (isPushup) metrics.dailyPushups += reps;
                    if (isSquat) metrics.dailySquats += reps;
                    if (isPlank) metrics.dailyPlankSeconds += secs;
                  }
                  if (t >= boundaries.startOfWeek.getTime()) {
                    if (isPushup) metrics.weeklyPushups += reps;
                    if (isSquat) metrics.weeklySquats += reps;
                    if (isPlank) metrics.weeklyPlankSeconds += secs;
                  }
                  if (t >= boundaries.startOfMonth.getTime()) {
                    if (isPushup) metrics.monthlyPushups += reps;
                    if (isSquat) metrics.monthlySquats += reps;
                    if (isPlank) metrics.monthlyPlankSeconds += secs;
                  }
                }
              } else if (!workError) {
                // If query returned 0 rows or offline, fallback to local history cache (synced workouts only)
                try {
                  const { useHistoryStore } = require("../workout/historyStore");
                  const localHistory = useHistoryStore.getState().history || [];
                  if (localHistory.length > 0) {
                    metrics = computeMetricsFromHistory(localHistory, false);
                  }
                } catch {}
              }

              if (achievements) {
                const invalidClaimIds: string[] = [];

                validCompleted = achievements.filter((row: any) => {
                  const t = new Date(row.created_at).getTime();
                  const isWithinTimeframe = (() => {
                    switch (row.type) {
                      case 'daily': return t >= boundaries.startOfDay.getTime();
                      case 'medium': return t >= boundaries.startOfWeek.getTime();
                      case 'hard': return t >= boundaries.startOfMonth.getTime();
                      default: return true;
                    }
                  })();

                  if (!isWithinTimeframe) return false;

                  // Strict Metric Verification: Ensure actual workout metrics support this claimed achievement
                  const quest = QUESTS.find(q => q.id === row.achievement_id);
                  if (quest) {
                    const currentProgress = getRawMetricForQuest(quest.id, metrics);
                    if (currentProgress < quest.target) {
                      invalidClaimIds.push(row.achievement_id);
                      return false;
                    }
                  }

                  return true;
                }).map((row: any) => row.achievement_id);

                // Asynchronously clean up any erroneous claims from Supabase
                if (invalidClaimIds.length > 0) {
                  supabase
                    .from("user_achievements")
                    .delete()
                    .eq("user_id", userId)
                    .in("achievement_id", invalidClaimIds)
                    .then(({ error: delError }) => {
                      if (delError) console.warn("[loadCompletedQuests] Failed to clean up invalid claims:", delError);
                    });
                }
              }
            } catch (networkErr) {
              console.warn("[loadCompletedQuests] Network exception, using local history cache:", networkErr);
              try {
                const { useHistoryStore } = require("../workout/historyStore");
                const localHistory = useHistoryStore.getState().history || [];
                if (localHistory.length > 0) {
                  metrics = computeMetricsFromHistory(localHistory, false);
                }
              } catch {}
            }
          } else {
            // Local / guest user fallback (counts all local workouts)
            try {
              const { useHistoryStore } = require("../workout/historyStore");
              const localHistory = useHistoryStore.getState().history || [];
              if (localHistory.length > 0) {
                metrics = computeMetricsFromHistory(localHistory, true);
              }
            } catch {}
          }

          set({ completedQuests: validCompleted, questMetrics: metrics, isLoading: false, isLoaded: true });
        } catch (e) {
          console.error("Error loading quests", e);
          set({ isLoading: false, isLoaded: true });
        }
      },

      claimQuest: async (userId: string, questId: string) => {
        const profile = useProfileStore.getState().profile;
        const currentXp = profile?.xp || 0;
        const quest = QUESTS.find(q => q.id === questId);
        if (!quest || get().completedQuests.includes(questId)) return;

        // Strict validation: Verify progress meets or exceeds target before allowing claim
        const progress = get().calculateProgress(quest);
        if (progress < quest.target) {
          console.warn(`[claimQuest] Blocked quest claim for ${questId}. Current progress: ${progress}/${quest.target}`);
          return;
        }

        if (userId && userId !== "local-user") {
          try {
            const { data: existing, error } = await supabase
              .from("user_achievements")
              .select("created_at")
              .eq("user_id", userId)
              .eq("achievement_id", questId);

            if (error) {
              console.warn("[claimQuest] Error checking existing achievements:", error);
            } else {
              const boundaries = getQuestBoundaries();

              const isAlreadyClaimedInDb = (existing || []).some((row: any) => {
                const t = new Date(row.created_at).getTime();
                switch (quest.type) {
                  case 'daily': return t >= boundaries.startOfDay.getTime();
                  case 'medium': return t >= boundaries.startOfWeek.getTime();
                  case 'hard': return t >= boundaries.startOfMonth.getTime();
                  default: return true;
                }
              });

              if (isAlreadyClaimedInDb) {
                if (!get().completedQuests.includes(questId)) {
                  set(state => ({ completedQuests: [...state.completedQuests, questId] }));
                }
                return;
              }
            }
          } catch (e) {
            console.warn("[claimQuest] Exception checking existing achievements:", e);
          }
        }

        // Optimistic UI update (mark complete locally)
        set(state => ({ completedQuests: [...state.completedQuests, questId] }));

        const newXp = currentXp + quest.xpReward;
        const newLevel = calculateLevelFromXp(newXp);

        // Optimistically update the UI so the user sees the level-up instantly
        useProfileStore.getState().updateProfile({ xp: newXp, level: newLevel });

        if (userId && userId !== "local-user") {
          try {
            const { networkService } = require("@/services/core/networkService");
            if (networkService.isInternetReachable()) {
              await supabase.from("user_achievements").upsert({
                user_id: userId,
                achievement_id: quest.id,
                type: quest.type,
                is_completed: true,
                progress: quest.target,
                created_at: new Date().toISOString()
              }, { onConflict: "user_id,achievement_id" });
            } else {
              // Offline Outbox Routing
              const { syncQueueService } = require("@/services/core/syncQueueService");
              syncQueueService.enqueue({
                userId,
                type: "CLAIM_QUEST",
                payload: {
                  achievement_id: quest.id,
                  type: quest.type,
                  target: quest.target,
                  progress: quest.target,
                },
              });
            }
          } catch (e) {
            console.error("Failed to claim quest in backend, enqueuing:", e);
            try {
              const { syncQueueService } = require("@/services/core/syncQueueService");
              syncQueueService.enqueue({
                userId,
                type: "CLAIM_QUEST",
                payload: {
                  achievement_id: quest.id,
                  type: quest.type,
                  target: quest.target,
                  progress: quest.target,
                },
              });
            } catch {}
          }
        }
      },

      calculateProgress: (quest: Achievement) => {
        let metrics = get().questMetrics;
        // If metrics is not yet loaded, compute fallback from local historyStore
        if (!metrics) {
          try {
            const { useHistoryStore } = require("../workout/historyStore");
            const localHistory = useHistoryStore.getState().history || [];
            if (localHistory.length > 0) {
              metrics = computeMetricsFromHistory(localHistory);
            }
          } catch {}
        }
        const dashboardData = useDashboardStore.getState().data;
        const rawProgress = getRawMetricForQuest(quest.id, metrics, dashboardData);
        return Math.min(rawProgress, quest.target);
      }
    }),
    {
      name: "replix-achievement-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        completedQuests: state.completedQuests,
        questMetrics: state.questMetrics,
        isLoaded: state.isLoaded,
      }),
    }
  )
);