import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { dashboardService, DashboardData } from "@/services/workout/dashboardService";
import { useTrophyStore } from "../gamification/trophyStore";
import { mmkvStorage } from "@/services/core/storageService";
import { networkService } from "@/services/core/networkService";
import { formatUserErrorMessage } from "@/utils/errorUtils";

interface DashboardState {
  data: DashboardData;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null; 
  // OPTIMIZATION 1: Strict Typing for Engine Safety
  _activeRequest: Promise<DashboardData> | null; 
  
  loadDashboardData: (userId: string, forceRefresh?: boolean) => Promise<void>;
  loadDailyData: (userId: string, date: Date) => Promise<void>;
  invalidateCache: () => void;
  // OPTIMIZATION 2: The Egress Killer (Zero DB Hit Updates)
  optimisticUpdate: (newData: Partial<DashboardData>) => void;
}

export const defaultDashboardData: DashboardData = {
  username: undefined,
  pushupReps: 0,
  formScore: 0,
  plankTimeMin: 0,
  totalVolume: 0,
  totalTimeHr: 0,
  squatReps: 0,
  accuracyTrend: [0, 0, 0, 0, 0, 0, 0],
  weeklySets: 0,
  totalTimeMin: 0,
  weeklyReps: 0,
  weeklyPushupAccuracy: 0,
  weeklySquatAccuracy: 0,
  totalSessions: 0,
};

const CACHE_TTL = 5 * 60 * 1000; 

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      data: defaultDashboardData,
      isLoading: false,
      error: null,
      lastFetched: null,
      _activeRequest: null,

      loadDashboardData: async (userId: string, forceRefresh = false) => {
        const { lastFetched, _activeRequest } = get();
        const now = Date.now();
        const isDifferentDay = lastFetched ? new Date(lastFetched).toDateString() !== new Date(now).toDateString() : false;

        // 1. ZERO-LATENCY CACHE HIT (only if same calendar day and within TTL)
        if (!forceRefresh && !isDifferentDay && lastFetched && (now - lastFetched < CACHE_TTL)) {
          return; 
        }

        // 2. OFFLINE GUARD: If offline and cached data exists, return silently
        if (!networkService.isInternetReachable() && (lastFetched || get().data.totalSessions > 0)) {
          set({ isLoading: false, error: null });
          return;
        }

        if (isDifferentDay) {
          set((state) => ({
            data: {
              ...state.data,
              todayPushupReps: 0,
              todaySquatReps: 0,
              todayPlankTimeMin: 0,
              todayWorkouts: 0,
            }
          }));
        }

        // 3. MUTEX LOCK (Stops simultaneous duplicate requests)
        if (_activeRequest && !forceRefresh) {
          await _activeRequest;
          return;
        }

        // 4. OPTIMISTIC SWR (No skeleton flash if cached data exists)
        const isFirstLoad = !lastFetched;
        if (isFirstLoad) {
          set({ isLoading: true, error: null });
        } else {
          set({ error: null }); 
        }

        try {
          const fetchPromise = dashboardService.fetchDashboardStats(userId);
          set({ _activeRequest: fetchPromise }); 

          const stats = await fetchPromise;
          
          // Check lifetime trophies
          if (stats.totalVolume >= 10000) {
            useTrophyStore.getState().unlockTrophy(userId, "gravity_defiant");
          }
          if (stats.totalSessions >= 100) {
            useTrophyStore.getState().unlockTrophy(userId, "the_centurion");
          }
          
          // Batched update to avoid JS thread blocking
          set({ 
            data: stats, 
            isLoading: false, 
            lastFetched: Date.now(), 
            _activeRequest: null 
          });

        } catch (error: any) {
          const hasCached = Boolean(get().lastFetched || get().data.totalSessions > 0);
          set({ 
            error: hasCached ? null : formatUserErrorMessage(error, "Failed to load dashboard data"), 
            isLoading: false,
            _activeRequest: null 
          });
        }
      },

      loadDailyData: async (userId: string, date: Date) => {
        try {
          const dailyStats = await dashboardService.fetchDailyStats(userId, date);
          get().optimisticUpdate(dailyStats);
        } catch (error) {
          console.error("[dashboardStore] Failed to load daily data for selected date:", error);
        }
      },

      invalidateCache: () => set({ lastFetched: null }),

      // Immediately updates dashboard data optimistically and persists to disk
      optimisticUpdate: (newData: Partial<DashboardData>) => {
        set((state) => ({
          data: { ...state.data, ...newData },
        }));
      },
    }),
    {
      name: "replix-dashboard-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        data: state.data,
        lastFetched: state.lastFetched,
      }),
    }
  )
);