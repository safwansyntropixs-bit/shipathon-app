import { create } from "zustand";
import { analyticsService } from "../../services/core/analyticsService";
import { premiumService, RevenueCatPackage } from "../../services/core/premiumService";
import { formatUserErrorMessage } from "@/utils/errorUtils";

interface PremiumState {
  offerings: RevenueCatPackage[];
  isLoadingOfferings: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  error: string | null;
  hasJustSubscribed: boolean;

  loadOfferings: (userId?: string) => Promise<void>;
  setJustSubscribed: (val: boolean) => void;
  purchase: (packageId: string, userId: string) => Promise<boolean>;
  restore: (userId: string) => Promise<boolean>;
}

export const usePremiumStore = create<PremiumState>((set) => ({
  offerings: [],
  isLoadingOfferings: false,
  isPurchasing: false,
  isRestoring: false,
  error: null,
  hasJustSubscribed: false,

  setJustSubscribed: (val) => set({ hasJustSubscribed: val }),

  loadOfferings: async (userId?: string) => {
    set({ isLoadingOfferings: true });
    try {
      const offerings = await premiumService.fetchOfferings(userId);
      set({ offerings, isLoadingOfferings: false, error: null });
    } catch (err: any) {
      set({ error: formatUserErrorMessage(err, "Failed to load offerings"), isLoadingOfferings: false });
    }
  },

  purchase: async (packageId: string, userId: string) => {
    analyticsService.trackEvent("purchase_started", {
      selected_tier: packageId,
    });
    set({ isPurchasing: true, error: null });
    try {
      const success = await premiumService.purchasePackage(packageId, userId);

      if (success) {
        try {
          const { useSubscriptionStore } = require("../user/subscriptionStore");
          useSubscriptionStore.getState().setSubscription({
            isPro: true,
            tier: packageId,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          });
        } catch (e) {
          console.warn("[premiumStore] Error syncing subscriptionStore:", e);
        }

        try {
          const { useProfileStore } = require("../user/profileStore");
          const currentProfile = useProfileStore.getState().profile;
          if (currentProfile) {
            useProfileStore.setState({ profile: { ...currentProfile, is_premium: true } });
          }
        } catch (e) {
          console.warn("[premiumStore] Error syncing profileStore:", e);
        }

        try {
          const { useHistoryStore } = require("../workout/historyStore");
          useHistoryStore.getState().invalidateCache();
          if (userId) {
            useHistoryStore.getState().loadInitialHistory(userId, true, true);
            useHistoryStore.getState().loadPersonalRecords(userId, true);
          }
        } catch (e) {
          console.warn("[premiumStore] Error invalidating history cache:", e);
        }
      }

      const revenue = packageId === "replix_annual" ? 29.99 : 4.99;
      analyticsService.trackEvent("purchase_completed", {
        selected_tier: packageId,
        revenue_usd: revenue,
      });

      set({ isPurchasing: false });
      return success;
    } catch (err: any) {
      analyticsService.trackEvent("purchase_failed", {
        error_code: err.message,
      });
      set({ error: formatUserErrorMessage(err, "Purchase failed"), isPurchasing: false });
      return false;
    }
  },

  restore: async (userId: string) => {
    analyticsService.trackEvent("restore_purchases_tapped");
    set({ isRestoring: true, error: null });
    try {
      const success = await premiumService.restorePurchases(userId);

      if (success) {
        try {
          const { useSubscriptionStore } = require("../user/subscriptionStore");
          useSubscriptionStore.getState().setSubscription({
            isPro: true,
            tier: "pro",
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          });
        } catch (e) {
          console.warn("[premiumStore] Error syncing subscriptionStore:", e);
        }

        try {
          const { useProfileStore } = require("../user/profileStore");
          const currentProfile = useProfileStore.getState().profile;
          if (currentProfile) {
            useProfileStore.setState({ profile: { ...currentProfile, is_premium: true } });
          }
        } catch (e) {
          console.warn("[premiumStore] Error syncing profileStore:", e);
        }

        try {
          const { useHistoryStore } = require("../workout/historyStore");
          useHistoryStore.getState().invalidateCache();
          if (userId) {
            useHistoryStore.getState().loadInitialHistory(userId, true, true);
            useHistoryStore.getState().loadPersonalRecords(userId, true);
          }
        } catch (e) {
          console.warn("[premiumStore] Error invalidating history cache:", e);
        }
      }

      set({ isRestoring: false });
      return success;
    } catch (err: any) {
      set({ error: formatUserErrorMessage(err, "Restore failed"), isRestoring: false });
      return false;
    }
  },
}));
