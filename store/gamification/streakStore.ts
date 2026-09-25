import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { streakService, StreakData } from "../../services/gamification/streakService";
import { mmkvStorage } from "../../services/core/storageService";
import { networkService } from "../../services/core/networkService";
import { formatUserErrorMessage } from "@/utils/errorUtils";

interface StreakState extends StreakData {
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null; 
  _activeRequest: Promise<StreakData> | null; 
  
  loadStreakData: (userId: string, forceRefresh?: boolean) => Promise<void>;
  optimisticRecordWorkout: (reps: number, completedAt?: Date) => { isStreakIncremented: boolean; newStreak: number };
  invalidateCache: () => void;
}

// CACHE EXPIRY TIME: 5 minutes. 
const CACHE_TTL = 5 * 60 * 1000; 

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      totalSessions: 0,
      totalReps: 0,
      achievements: [],
      missedDay: false,
      lastWorkoutDate: null,
      isLoading: false, 
      error: null,
      lastFetched: null,
      _activeRequest: null,

      loadStreakData: async (userId: string, forceRefresh = false) => {
        const { lastFetched, _activeRequest } = get();
        const now = Date.now();

        // 1. INSTANT ZERO-LATENCY CACHE HIT
        if (!forceRefresh && lastFetched && (now - lastFetched < CACHE_TTL)) {
          return; 
        }

        // 2. OFFLINE GUARD: If offline and cached data exists, return silently
        if (!networkService.isInternetReachable() && (lastFetched || get().totalSessions > 0)) {
          set({ isLoading: false, error: null });
          return;
        }

        // 3. MUTEX LOCK (Stops database spamming)
        if (_activeRequest && !forceRefresh) {
          await _activeRequest;
          return;
        }

        // 4. OPTIMISTIC UI / SWR (No skeleton flash if cached data exists)
        const isFirstLoad = !lastFetched;
        if (isFirstLoad) {
          set({ isLoading: true, error: null });
        } else {
          set({ error: null }); 
        }

        try {
          const fetchPromise = streakService.fetchStreakData(userId);
          set({ _activeRequest: fetchPromise }); // Engine Locked

          const data = await fetchPromise;
          
          // Batch update completely clears UI jitter
          set({ 
            ...data, 
            isLoading: false, 
            lastFetched: Date.now(), 
            _activeRequest: null 
          });

        } catch (err: any) {
          const hasCached = Boolean(get().lastFetched || get().totalSessions > 0);
          set({ 
            error: hasCached ? null : formatUserErrorMessage(err, "Failed to load streak data"), 
            isLoading: false,
            _activeRequest: null 
          });
        }
      },

      /**
       * Optimistically records a workout completion with strict same-day idempotency.
       * A streak ONLY increments once per calendar day. Subsequent workouts on the same day
       * increment totalSessions and totalReps, but DO NOT artificially inflate currentStreak.
       */
      optimisticRecordWorkout: (reps: number, completedAt: Date = new Date()) => {
        const state = get();
        const now = completedAt;
        
        // Format dates in YYYY-MM-DD
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        const yesterday = new Date(now.getTime() - 86400000);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        let lastDateStr: string | null = null;
        if (state.lastWorkoutDate) {
          const d = new Date(state.lastWorkoutDate);
          if (!isNaN(d.getTime())) {
            lastDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
        }

        // Cross-reference with dashboardStore & historyStore for bulletproof same-day check
        let alreadyWorkedOutToday = false;
        if (lastDateStr === todayStr) {
          alreadyWorkedOutToday = true;
        } else {
          try {
            const { useDashboardStore } = require("../workout/dashboardStore");
            const dbData = useDashboardStore.getState().data;
            if (dbData && (dbData.todayWorkouts || 0) > 0) {
              alreadyWorkedOutToday = true;
            }
          } catch {}

          if (!alreadyWorkedOutToday) {
            try {
              const { useHistoryStore } = require("../workout/historyStore");
              const history = useHistoryStore.getState().history || [];
              const todayDateString = now.toDateString();
              const hasTodayHistory = history.some((h: any) => {
                const hd = h.timestamp ? new Date(h.timestamp) : (h.date ? new Date(h.date) : null);
                return hd && hd.toDateString() === todayDateString;
              });
              if (hasTodayHistory) {
                alreadyWorkedOutToday = true;
              }
            } catch {}
          }
        }

        let nextStreak = state.currentStreak || 0;
        let isStreakIncremented = false;

        if (alreadyWorkedOutToday) {
          // Already completed at least one workout today: keep the streak stable!
          nextStreak = Math.max(1, state.currentStreak || 1);
          isStreakIncremented = false;
        } else {
          // First workout of today!
          if (lastDateStr === yesterdayStr) {
            // Worked out yesterday -> increment streak by 1
            nextStreak = (state.currentStreak || 0) + 1;
          } else {
            // Missed yesterday or starting fresh -> streak is 1
            nextStreak = 1;
          }
          isStreakIncremented = true;
        }

        const nextLongest = Math.max(state.longestStreak || 0, nextStreak);
        const nextSessions = (state.totalSessions || 0) + 1;
        const nextReps = (state.totalReps || 0) + reps;

        set({
          currentStreak: nextStreak,
          longestStreak: nextLongest,
          lastWorkoutDate: now.toISOString(),
          totalSessions: nextSessions,
          totalReps: nextReps,
          missedDay: false,
        });

        return { isStreakIncremented, newStreak: nextStreak };
      },

      // CALL THIS: After a workout session finishes
      invalidateCache: () => set({ lastFetched: null }),
    }),
    {
      name: "replix-streak-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        totalSessions: state.totalSessions,
        totalReps: state.totalReps,
        achievements: state.achievements,
        missedDay: state.missedDay,
        lastWorkoutDate: state.lastWorkoutDate,
        lastFetched: state.lastFetched,
      }),
    }
  )
);