import { LeaderboardEntry } from "@/types/leaderboard.types";
import { create } from "zustand";
import { useSubscriptionStore } from "../user/subscriptionStore";
import {
  LeaderboardScope,
  LeaderboardTimeframe,
  leaderboardService,
} from "../../services/social/leaderboardService";
import { formatUserErrorMessage } from "@/utils/errorUtils";

interface LeaderboardState {
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
  scope: LeaderboardScope;
  timeframe: LeaderboardTimeframe;
  
  // Pagination State
  page: number;
  limit: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: string | null;

  setScope: (scope: LeaderboardScope, userId: string) => Promise<void>;
  setTimeframe: (timeframe: LeaderboardTimeframe, userId: string) => Promise<void>;
  
  loadLeaderboard: (userId?: string) => Promise<void>;
  fetchNextPage: (userId?: string) => Promise<void>;
  loadCurrentUserRank: (userId: string) => Promise<void>;
}

const checkIsProActive = () => {
  const subState = useSubscriptionStore.getState();
  const { useProfileStore } = require("../user/profileStore");
  const profileState = useProfileStore.getState();

  // 1. Explicit expiration check
  if (subState.expiresAt && new Date(subState.expiresAt).getTime() <= Date.now()) {
    subState.checkExpiration?.();
    return false;
  }

  // 2. Pro if subscription is active OR profile has is_premium = true
  return Boolean(subState.isPro || profileState.profile?.is_premium);
};

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  entries: [],
  currentUserEntry: null,
  scope: "global",
  timeframe: "weekly", // Default changed to weekly
  
  page: 1,
  limit: 20,
  hasMore: true,
  isLoading: true,
  isFetchingNextPage: false,
  error: null,

  setScope: async (scope, userId) => {
    if (get().scope === scope) return;
    
    // Force weekly timeframe for friends scope
    if (scope === "friends") {
      set({ scope, timeframe: "weekly", isLoading: true, entries: [], page: 1, hasMore: true });
    } else {
      set({ scope, isLoading: true, entries: [], page: 1, hasMore: true });
    }
    
    await get().loadLeaderboard(userId);
  },

  setTimeframe: async (timeframe, userId) => {
    if (get().timeframe === timeframe) return;

    // Strict Pro Gate: If attempting to switch to monthly without active Pro subscription, abort
    if (timeframe === "monthly" && !checkIsProActive()) {
      return;
    }

    set({ timeframe, isLoading: true, entries: [], page: 1, hasMore: true });
    await get().loadLeaderboard(userId);
  },

  loadCurrentUserRank: async (userId: string) => {
    const { timeframe, scope } = get();
    // Only need independent rank if in global view (friends list always contains the user)
    if (scope === "global") {
       // If monthly and not Pro, abort
       if (timeframe === "monthly" && !checkIsProActive()) {
         set({ currentUserEntry: null });
         return;
       }
       const entry = await leaderboardService.fetchCurrentUserRank(timeframe, userId);
       set({ currentUserEntry: entry });
    }
  },

  loadLeaderboard: async (userId?: string) => {
    const normalizedUserId = userId ?? "guest";
    const { scope, timeframe, limit } = get();

    // Strict Pro Gate for Global Monthly view
    if (scope === "global" && timeframe === "monthly" && !checkIsProActive()) {
      set({
        timeframe: "weekly",
        isLoading: false,
        error: null,
      });
      return get().loadLeaderboard(userId);
    }

    const { networkService } = require("@/services/core/networkService");
    const hasCachedEntries = get().entries.length > 0;

    if (!networkService.isInternetReachable() && hasCachedEntries) {
      set({ isLoading: false, error: null });
      return;
    }

    set({ isLoading: !hasCachedEntries, error: null, page: 1 });
    
    try {
      const [entries] = await Promise.all([
        leaderboardService.fetchLeaderboard(scope, timeframe, normalizedUserId, 1, limit),
        get().loadCurrentUserRank(normalizedUserId)
      ]);
      
      const safeEntries = Array.isArray(entries) ? entries : [];

      set({ 
        entries: safeEntries, 
        isLoading: false,
        hasMore: safeEntries.length === limit,
        page: 1,
        error: null,
      });
    } catch (err: any) {
      if (hasCachedEntries) {
        set({ isLoading: false, error: null });
      } else {
        const isOffline = !networkService.isInternetReachable();
        set({ 
          error: isOffline ? "Offline. Connect to the internet to load leaderboard rankings." : formatUserErrorMessage(err, "Failed to load leaderboard"), 
          isLoading: false 
        });
      }
    }
  },

  fetchNextPage: async (userId?: string) => {
    const { scope, timeframe, page, limit, hasMore, isFetchingNextPage, isLoading, entries } = get();
    const normalizedUserId = userId ?? "guest";
    
    // Strict race-condition guard
    if (!hasMore || isFetchingNextPage || isLoading) return;
    
    // Friends list doesn't paginate
    if (scope === "friends") return;

    // Monthly Pro Gate Guard
    if (scope === "global" && timeframe === "monthly" && !checkIsProActive()) {
      return;
    }

    const nextPage = page + 1;
    set({ isFetchingNextPage: true });
    
    try {
      const newEntries = await leaderboardService.fetchLeaderboard(
        scope, 
        timeframe, 
        normalizedUserId, 
        nextPage, 
        limit
      );
      
      const safeNewEntries = Array.isArray(newEntries) ? newEntries : [];

      set({
        entries: [...entries, ...safeNewEntries],
        page: nextPage,
        hasMore: safeNewEntries.length === limit,
        isFetchingNextPage: false
      });
    } catch (err: any) {
      set({ isFetchingNextPage: false });
    }
  }
}));
