import { LeaderboardEntry } from '@/types/leaderboard.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CelebrationModalData } from '../../components/modals/CelebrationModal';
import { historyRepository } from '../../repositories/workout/historyRepository';
import { leaderboardService } from '../../services/social/leaderboardService';
import { useProfileStore } from '../user/profileStore';

export type CelebrationType = "weekly_friends" | "weekly_global" | "monthly_global";

export const getCompletedMonthId = (now: Date = new Date()): string => {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getCompletedWeekId = (now: Date = new Date()): string => {
  const day = now.getUTCDay();
  const diff = day === 0 ? 7 : day;
  const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  const d = new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const weekNo = Math.ceil((((d.getTime() - new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export const formatPeriodLabel = (isMonthly: boolean, now: Date = new Date()): string => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (isMonthly) {
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate();
    return `1 ${months[prev.getUTCMonth()]} - ${lastDay} ${months[prev.getUTCMonth()]}`;
  }
  const diff = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const sun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  const mon = new Date(sun);
  mon.setUTCDate(sun.getUTCDate() - 6);
  return `${mon.getUTCDate()} ${months[mon.getUTCMonth()]} - ${sun.getUTCDate()} ${months[sun.getUTCMonth()]}`;
};

interface CelebrationState {
  isOpen: boolean;
  activeData: CelebrationModalData | null;
  lastCelebratedWeekId: string | null;
  lastCelebratedMonthId: string | null;
  checkAutomaticCelebrations: (userId: string, isPeriodEndEvent?: boolean) => Promise<void>;
  triggerCelebration: (type: CelebrationType, userId: string, isManualTest?: boolean) => Promise<void>;
  closeCelebration: () => void;
  resetCelebrationForTesting: () => void;
}

export const useRecapStore = create<CelebrationState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      activeData: null,
      lastCelebratedWeekId: null,
      lastCelebratedMonthId: null,

      checkAutomaticCelebrations: async (userId: string, isPeriodEndEvent: boolean = false) => {
        if (!userId || userId === "guest") return;
        const now = new Date();
        const state = get();

        const monthId = getCompletedMonthId(now);
        const weekId = getCompletedWeekId(now);

        // First launch initialization: prevent popping up old periods on fresh install
        if (!state.lastCelebratedMonthId) {
          set({ lastCelebratedMonthId: monthId });
        }
        if (!state.lastCelebratedWeekId) {
          set({ lastCelebratedWeekId: weekId });
        }

        // Monthly check: only trigger when period ends or on 1st of month
        const isMonthBoundary = isPeriodEndEvent || now.getUTCDate() === 1;
        if (isMonthBoundary && state.lastCelebratedMonthId !== monthId) {
          await get().triggerCelebration("monthly_global", userId, false);
          return;
        }

        // Weekly check: only trigger when week ends (real-time event) or on Monday (UTC day 1)
        const isWeekBoundary = isPeriodEndEvent || now.getUTCDay() === 1;
        if (isWeekBoundary && state.lastCelebratedWeekId !== weekId) {
          await get().triggerCelebration("weekly_global", userId, false);
        }
      },

      triggerCelebration: async (type: CelebrationType, userId: string, isManualTest: boolean = false) => {
        try {
          if (!userId || userId === "guest") return;

          const now = new Date();
          const state = get();
          const isMonthly = type === "monthly_global";
          const isFriends = type === "weekly_friends";

          const monthId = getCompletedMonthId(now);
          const weekId = getCompletedWeekId(now);

          // Guard against duplicate triggers
          if (!isManualTest) {
            if (isMonthly && state.lastCelebratedMonthId === monthId) return;
            if (!isMonthly && state.lastCelebratedWeekId === weekId) return;
          }

          let profile = useProfileStore.getState().profile;
          if (!profile) {
            try {
              await useProfileStore.getState().fetchProfile();
              profile = useProfileStore.getState().profile;
            } catch { }
          }

          // Fetch past period stats & leaderboard
          const [stats, top3Raw, userRankRaw] = await Promise.all([
            historyRepository.getStatisticsRangeData(userId, isMonthly ? "month" : "week", -1).catch(() => null),
            isFriends
              ? leaderboardService.fetchLeaderboard("friends", "weekly", userId, 1, 3, -1).catch(() => [])
              : leaderboardService.fetchLeaderboard("global", isMonthly ? "monthly" : "weekly", userId, 1, 3, -1).catch(() => []),
            isFriends
              ? leaderboardService.fetchLeaderboard("friends", "weekly", userId, 1, 50, -1).then((l) => l.find((e) => e.id === userId) || null).catch(() => null)
              : leaderboardService.fetchCurrentUserRank(isMonthly ? "monthly" : "weekly", userId, -1).catch(() => null),
          ]);

          const totalReps = stats?.reps || 0;
          const totalSets = stats?.sets || 0;
          const plankSec = stats?.plankTimeSec || 0;
          const earnedXP = typeof userRankRaw?.score === "number" ? userRankRaw.score : 0;
          const activeDays = (stats as any)?.activeDays || 0;
          const hasActivity = totalSets > 0 || totalReps > 0 || plankSec > 0 || earnedXP > 0 || activeDays > 0;

          // If no activity in that completed period, mark as checked and exit
          if (!isManualTest && !hasActivity) {
            if (isMonthly) set({ lastCelebratedMonthId: monthId });
            else set({ lastCelebratedWeekId: weekId });
            return;
          }

          // Mark period celebrated
          if (!isManualTest) {
            if (isMonthly) set({ lastCelebratedMonthId: monthId });
            else set({ lastCelebratedWeekId: weekId });
          }

          let top3: LeaderboardEntry[] = Array.isArray(top3Raw) ? [...top3Raw] : [];
          if (isManualTest && top3.length === 0) {
            top3 = [
              { rank: 1, id: "m1", name: "Alex V.", avatar: null, score: isMonthly ? 7450 : 2450, country_flag: "🇺🇸" },
              { rank: 2, id: "m2", name: "Sarah K.", avatar: null, score: isMonthly ? 6800 : 2100, country_flag: "🇨🇦" },
              { rank: 3, id: "m3", name: "Elena R.", avatar: null, score: isMonthly ? 6200 : 1850, country_flag: "🇬🇧" },
            ];
          }

          const myRank = Number(userRankRaw?.rank) || (isManualTest ? 5 : 9999);
          const myScore = earnedXP > 0 ? earnedXP : (isManualTest ? (isMonthly ? 5600 : 1720) : totalReps);

          const modalData: CelebrationModalData = {
            type,
            heading: isFriends ? "Weekly Friends Rankings" : isMonthly ? "Monthly Global Rankings" : "Weekly Global Rankings",
            periodLabel: formatPeriodLabel(isMonthly, now),
            top3,
            currentUserEntry: {
              rank: myRank,
              id: userId,
              name: profile?.username || "You",
              avatar: profile?.avatar_url || null,
              score: myScore,
              isCurrentUser: true,
              level: profile?.level || 1,
            },
            stats: {
              workouts: totalSets > 0 ? totalSets : (isManualTest ? (isMonthly ? 22 : 6) : 1),
              totalXP: myScore,
              activeDays: activeDays > 0 ? activeDays : (isManualTest ? (isMonthly ? 18 : 5) : 1),
              pushupReps: stats?.pushupReps || (isManualTest ? (isMonthly ? 540 : 180) : totalReps),
              squatReps: stats?.squatReps || (isManualTest ? (isMonthly ? 420 : 140) : 0),
              plankTimeSec: plankSec || (isManualTest ? (isMonthly ? 720 : 240) : 0),
              accuracy: stats?.accuracy || (isManualTest ? 93 : 88),
            },
            username: profile?.username || "Athlete",
            avatarUrl: profile?.avatar_url || undefined,
            level: profile?.level || 1,
          };

          set({ activeData: modalData, isOpen: true });
        } catch (err) {
          console.error("Failed to trigger celebration", err);
        }
      },

      closeCelebration: () => set({ isOpen: false, activeData: null }),
      resetCelebrationForTesting: () => set({ lastCelebratedWeekId: null, lastCelebratedMonthId: null, activeData: null, isOpen: false }),
    }),
    {
      name: 'celebration-recap-storage',
      version: 5,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any) => ({
        lastCelebratedWeekId: persistedState?.lastCelebratedWeekId || null,
        lastCelebratedMonthId: persistedState?.lastCelebratedMonthId || null,
      }),
      // CRITICAL: Only persist period IDs, NEVER persist isOpen or activeData in storage
      partialize: (state) => ({
        lastCelebratedWeekId: state.lastCelebratedWeekId,
        lastCelebratedMonthId: state.lastCelebratedMonthId,
      }),
    }
  )
);
