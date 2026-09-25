import { create } from "zustand";
import { analyticsService } from "../../services/core/analyticsService";

interface AnalyticsState {
  isInitialized: boolean;
  isOptedOut: boolean;
  initializeAnalytics: () => Promise<void>;
  setOptOut: (optOut: boolean) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  isInitialized: false,
  isOptedOut: false,

  initializeAnalytics: async () => {
    set({ isInitialized: true });
  },

  setOptOut: (optOut: boolean) => {
    analyticsService.setOptOut(optOut);
    set({ isOptedOut: optOut });
  },
}));
