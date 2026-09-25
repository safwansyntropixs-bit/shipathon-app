import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { HistoryItem, PersonalRecords, historyService } from "../../services/workout/historyService";
import { mmkvStorage } from "../../services/core/storageService";
import { networkService } from "../../services/core/networkService";
import { formatUserErrorMessage } from "@/utils/errorUtils";

export const isPastMonth = (date: Date): boolean => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const targetYear = dateObj.getFullYear();
  const targetMonth = dateObj.getMonth();

  if (targetYear < currentYear) return true;
  if (targetYear === currentYear && targetMonth < currentMonth) return true;
  return false;
};

export const resolveEffectiveIsPro = async (explicitIsPro?: boolean): Promise<boolean> => {
  if (explicitIsPro === true) return true;

  const { useSubscriptionStore } = require("../user/subscriptionStore");
  const { useProfileStore } = require("../user/profileStore");

  // Ensure both stores have finished hydrating from AsyncStorage before applying Free Tier gates
  const checkHydrated = () => {
    const subHydrated = Boolean(useSubscriptionStore.getState()._hasHydrated);
    const profileHydrated = Boolean(useProfileStore.getState()._hasHydrated);
    return subHydrated && profileHydrated;
  };

  if (!checkHydrated()) {
    await new Promise<void>((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 300);

      const checkInterval = setInterval(() => {
        if (checkHydrated()) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      }, 20);
    });
  }

  const subState = useSubscriptionStore.getState();
  const profileState = useProfileStore.getState();

  // 1. Explicit expiration check: if expiresAt has passed, user is NEVER Pro
  if (subState.expiresAt && new Date(subState.expiresAt).getTime() <= Date.now()) {
    subState.checkExpiration?.();
    return false;
  }

  // 2. Pro if subscription is active OR profile has is_premium = true
  return Boolean(subState.isPro || profileState.profile?.is_premium);
};

export const getDateRange = (monthDate: Date, selectedDay: number | null) => {
  const dateObj = typeof monthDate === "string" ? new Date(monthDate) : monthDate;
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  if (selectedDay !== null) {
    const start = new Date(year, month, selectedDay, 0, 0, 0, 0);
    const end = new Date(year, month, selectedDay, 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
};

const CHUNK_SIZE = 10;

interface CacheItem {
  history: HistoryItem[];
  hasMore: boolean;
  timestamp: number;
}

interface HistoryState {
  // UI State (decoupled from server list)
  selectedMonthDate: Date;
  selectedDay: number | null;
  filterType: string;

  // Server Data State
  history: HistoryItem[];
  personalRecords: PersonalRecords | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRangeStatsLoading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  cache: Record<string, CacheItem>;
  _activeRequest: string | null;
  rangeStats: any | null;

  // Actions
  loadInitialHistory: (userId: string, isPro?: boolean, forceRefresh?: boolean) => Promise<void>;
  loadPersonalRecords: (userId: string, forceRefresh?: boolean) => Promise<void>;
  loadMoreHistory: (userId: string, isPro?: boolean) => Promise<void>;
  setSelectedMonth: (date: Date, userId: string, isPro?: boolean) => Promise<void>;
  setSelectedDay: (day: number | null, userId: string, isPro?: boolean) => Promise<void>;
  setFilterType: (type: string, userId: string, isPro?: boolean) => Promise<void>;

  // Backward compatible & helper actions
  loadHistory: (userId: string, forceRefresh?: boolean) => Promise<void>;
  loadPage: (userId: string, targetPage: number, forceRefresh?: boolean) => Promise<void>;
  loadRangeStats: (userId: string, range: string, isPro?: boolean) => Promise<void>;
  invalidateCache: () => void;
  addOptimisticWorkout: (item: HistoryItem) => void;
  updateSyncStatus: (workoutId: string, status: 'pending' | 'syncing' | 'synced' | 'error' | 'dead_letter') => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => {
      const initialDate = new Date();
      initialDate.setDate(1);

      return {
        selectedMonthDate: initialDate,
        selectedDay: null,
        filterType: "all",

        history: [],
        personalRecords: null,
        isLoading: false,
        isLoadingMore: false,
        isRangeStatsLoading: false,
        error: null,
        page: 1,
        hasMore: true,
        cache: {},
        _activeRequest: null,
        rangeStats: null,

        loadPersonalRecords: async (userId: string, forceRefresh = false) => {
          const currentPr = get().personalRecords;
          if (!forceRefresh && currentPr && (currentPr.maxPushups > 0 || currentPr.maxSquats > 0 || currentPr.maxPlankTime > 0)) {
            return;
          }
          try {
            const prData = await historyService.fetchPersonalRecords(userId);
            if (prData) {
              set({ personalRecords: prData });
            } else {
              set({ personalRecords: { maxPushups: 0, maxSquats: 0, maxPlankTime: 0 } });
            }
          } catch (err) {
            console.error("[historyStore] loadPersonalRecords Error:", err);
            set({ personalRecords: { maxPushups: 0, maxSquats: 0, maxPlankTime: 0 } });
          }
        },

        loadInitialHistory: async (userId: string, isPro?: boolean, forceRefresh = false) => {
          const effectiveIsPro = await resolveEffectiveIsPro(isPro);
          const state = get();
          const { selectedMonthDate, selectedDay, filterType, cache, personalRecords } = state;

          const hasValidPrs = personalRecords && (personalRecords.maxPushups > 0 || personalRecords.maxSquats > 0 || personalRecords.maxPlankTime > 0);
          const shouldFetchPr = !hasValidPrs || forceRefresh;

          // Always ensure personal records are loaded in parallel
          if (shouldFetchPr) {
            get().loadPersonalRecords(userId, forceRefresh);
          }

          // FREE TIER GATE: If non-Pro user views a past month, do NOT query the database for workout list
          if (!effectiveIsPro && isPastMonth(selectedMonthDate)) {
            set({
              history: [],
              page: 1,
              hasMore: false,
              isLoading: false,
              isLoadingMore: false,
              error: null,
            });
            return;
          }

          const dateKey = `${selectedMonthDate.getFullYear()}-${selectedMonthDate.getMonth() + 1}_${selectedDay ?? "all"}`;
          const cacheKey = `${filterType}_${dateKey}_p1`;

          // Check Cache first
          if (!forceRefresh && cache[cacheKey]) {
            const cached = cache[cacheKey];
            set({
              history: cached.history,
              page: 1,
              hasMore: cached.hasMore,
              isLoading: false,
              isLoadingMore: false,
              error: null,
            });

            const isStale = Date.now() - cached.timestamp > 5 * 60 * 1000;
            if (!isStale) return;
          }

          const hasExistingHistory = state.history && state.history.length > 0;

          // OFFLINE GUARD: If offline and cached data exists, return silently
          if (!networkService.isInternetReachable() && (cache[cacheKey] || hasExistingHistory)) {
            set({ isLoading: false, error: null });
            return;
          }

          const requestKey = `${filterType}_${dateKey}_p1`;
          if (state._activeRequest === requestKey && !forceRefresh) return;

          set({ isLoading: !cache[cacheKey] && !hasExistingHistory, error: null, _activeRequest: requestKey });

          try {
            const { useProfileStore } = require("../user/profileStore");
            const weightKg = useProfileStore.getState().profile?.weight_kg;
            const { startDate, endDate } = getDateRange(selectedMonthDate, selectedDay);

            const fetchTasks: Promise<any>[] = [
              historyService.fetchUserHistory(userId, filterType, 1, CHUNK_SIZE, weightKg, startDate, endDate),
            ];

            if (shouldFetchPr) {
              fetchTasks.push(historyService.fetchPersonalRecords(userId));
            }

            const results = await Promise.all(fetchTasks);
            const historyData = results[0] || [];
            const prData = results.length > 1 && results[1]
              ? results[1]
              : get().personalRecords || { maxPushups: 0, maxSquats: 0, maxPlankTime: 0 };
            const newHasMore = historyData.length === CHUNK_SIZE;

            set((currentState) => {
              const isStillSameFilter =
                currentState.filterType === filterType &&
                currentState.selectedDay === selectedDay &&
                new Date(currentState.selectedMonthDate).getTime() === new Date(selectedMonthDate).getTime();

              return {
                ...(isStillSameFilter && {
                  history: historyData,
                  page: 1,
                  hasMore: newHasMore,
                  isLoading: false,
                  isLoadingMore: false,
                  error: null,
                }),
                personalRecords: prData,
                _activeRequest: currentState._activeRequest === requestKey ? null : currentState._activeRequest,
                cache: {
                  ...currentState.cache,
                  [cacheKey]: {
                    history: historyData,
                    hasMore: newHasMore,
                    timestamp: Date.now(),
                  },
                },
              };
            });
          } catch (err: any) {
            set((currentState) => {
              const isStillSameFilter = currentState.filterType === filterType;
              const hasExisting = Boolean(currentState.history && currentState.history.length > 0) || Boolean(currentState.cache[cacheKey]);
              return {
                ...(isStillSameFilter && {
                  error: hasExisting ? null : formatUserErrorMessage(err, "Failed to load workouts"),
                  isLoading: false,
                  isLoadingMore: false,
                }),
                _activeRequest: currentState._activeRequest === requestKey ? null : currentState._activeRequest,
              };
            });
          }
        },

        loadMoreHistory: async (userId: string, isPro?: boolean) => {
          const state = get();
          const {
            hasMore,
            isLoadingMore,
            isLoading,
            page,
            selectedMonthDate,
            selectedDay,
            filterType,
          } = state;

          if (!hasMore || isLoadingMore || isLoading) return;

          const effectiveIsPro = await resolveEffectiveIsPro(isPro);
          if (!effectiveIsPro && isPastMonth(selectedMonthDate)) {
            return;
          }

          const nextPage = page + 1;
          const dateKey = `${selectedMonthDate.getFullYear()}-${selectedMonthDate.getMonth() + 1}_${selectedDay ?? "all"}`;
          const requestKey = `${filterType}_${dateKey}_p${nextPage}`;

          if (state._activeRequest === requestKey) return;

          set({ isLoadingMore: true, _activeRequest: requestKey });

          try {
            const { useProfileStore } = require("../user/profileStore");
            const weightKg = useProfileStore.getState().profile?.weight_kg;
            const { startDate, endDate } = getDateRange(selectedMonthDate, selectedDay);

            const newItems = await historyService.fetchUserHistory(
              userId,
              filterType,
              nextPage,
              CHUNK_SIZE,
              weightKg,
              startDate,
              endDate
            );

            const newHasMore = (newItems || []).length === CHUNK_SIZE;

            set((currentState) => {
              const isStillSameFilter =
                currentState.filterType === filterType &&
                currentState.selectedDay === selectedDay &&
                new Date(currentState.selectedMonthDate).getTime() === new Date(selectedMonthDate).getTime();

              if (!isStillSameFilter) {
                return {
                  isLoadingMore: false,
                  _activeRequest: currentState._activeRequest === requestKey ? null : currentState._activeRequest,
                };
              }

              return {
                history: [...currentState.history, ...newItems],
                page: nextPage,
                hasMore: newHasMore,
                isLoadingMore: false,
                _activeRequest: currentState._activeRequest === requestKey ? null : currentState._activeRequest,
              };
            });
          } catch (err: any) {
            set((currentState) => ({
              isLoadingMore: false,
              _activeRequest: currentState._activeRequest === requestKey ? null : currentState._activeRequest,
            }));
          }
        },

        setSelectedMonth: async (date: Date, userId: string, isPro?: boolean) => {
          const normalizedDate = new Date(date.getFullYear(), date.getMonth(), 1);
          set({ selectedMonthDate: normalizedDate, selectedDay: null, history: [], page: 1, hasMore: true, isLoading: true });
          await get().loadInitialHistory(userId, isPro);
        },

        setSelectedDay: async (day: number | null, userId: string, isPro?: boolean) => {
          const currentDay = get().selectedDay;
          if (currentDay === day) return;
          set({ selectedDay: day, history: [], page: 1, hasMore: true, isLoading: true });
          await get().loadInitialHistory(userId, isPro);
        },

        setFilterType: async (type: string, userId: string, isPro?: boolean) => {
          const { filterType } = get();
          if (filterType === type) return;

          set({ filterType: type, page: 1, history: [], hasMore: true, isLoading: true });
          await get().loadInitialHistory(userId, isPro);
        },

        // Backward compatibility aliases
        loadHistory: async (userId: string, forceRefresh = false) => {
          return get().loadInitialHistory(userId, undefined, forceRefresh);
        },

        loadPage: async (userId: string, targetPage: number, forceRefresh = false) => {
          if (targetPage > 1) {
            return get().loadMoreHistory(userId);
          }
          return get().loadInitialHistory(userId, undefined, forceRefresh);
        },

        loadRangeStats: async (userId: string, range: string, isPro?: boolean) => {
          const effectiveIsPro = await resolveEffectiveIsPro(isPro);

          // FREE TIER GATE: Free users can ONLY load 'week' statistics. 'month' and 'year' are Pro-only.
          if (!effectiveIsPro && (range === "month" || range === "year")) {
            set({ isRangeStatsLoading: false, rangeStats: null });
            return;
          }

          const { networkService } = require("@/services/core/networkService");
          const hasCached = get().rangeStats !== null;

          if (!networkService.isInternetReachable() && hasCached) {
            set({ isRangeStatsLoading: false });
            return;
          }

          set({ isRangeStatsLoading: !hasCached });
          try {
            const data = await historyService.fetchStatisticsRangeData(userId, range);
            if (data) {
              set({ rangeStats: data, isRangeStatsLoading: false });
            } else {
              set({ isRangeStatsLoading: false });
            }
          } catch (error) {
            if (!hasCached) {
              console.warn("[historyStore] Error loading range stats:", error);
            }
            set({ isRangeStatsLoading: false });
          }
        },

        invalidateCache: () => {
          const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          set({
            cache: {},
            selectedMonthDate: currentMonth,
            selectedDay: null,
          });
        },

        addOptimisticWorkout: (item: HistoryItem) => {
          set((state) => {
            const filteredHistory = state.history.filter((h) => h.id !== item.id);
            const newHistory = [item, ...filteredHistory];

            // Optimistically update personal records
            let updatedPr = state.personalRecords ? { ...state.personalRecords } : { maxPushups: 0, maxSquats: 0, maxPlankTime: 0 };
            const exLower = (item.exercise || "").toLowerCase();
            if (exLower.includes("pushup") && item.reps > updatedPr.maxPushups) {
              updatedPr.maxPushups = item.reps;
            } else if (exLower.includes("squat") && item.reps > updatedPr.maxSquats) {
              updatedPr.maxSquats = item.reps;
            } else if (exLower.includes("plank") && (item.plankSeconds || 0) > updatedPr.maxPlankTime) {
              updatedPr.maxPlankTime = item.plankSeconds || 0;
            }

            // Prepend to all active cache buckets
            const updatedCache: Record<string, CacheItem> = {};
            Object.keys(state.cache).forEach((key) => {
              const bucket = state.cache[key];
              const filteredBucket = (bucket.history || []).filter((h) => h.id !== item.id);
              updatedCache[key] = {
                ...bucket,
                history: [item, ...filteredBucket],
              };
            });

            return {
              history: newHistory,
              personalRecords: updatedPr,
              cache: updatedCache,
            };
          });
        },

        updateSyncStatus: (workoutId: string, status: 'pending' | 'syncing' | 'synced' | 'error' | 'dead_letter') => {
          set((state) => {
            const updatedHistory = state.history.map((h) => (h.id === workoutId ? { ...h, syncStatus: status } : h));
            const updatedCache: Record<string, CacheItem> = {};
            Object.keys(state.cache).forEach((key) => {
              const bucket = state.cache[key];
              updatedCache[key] = {
                ...bucket,
                history: (bucket.history || []).map((h) => (h.id === workoutId ? { ...h, syncStatus: status } : h)),
              };
            });

            return {
              history: updatedHistory,
              cache: updatedCache,
            };
          });
        },
      };
    },
    {
      name: "replix-history-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        history: state.history,
        personalRecords: state.personalRecords,
        cache: state.cache,
        rangeStats: state.rangeStats,
      }),
    }
  )
);