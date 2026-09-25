import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { formatUserErrorMessage } from "@/utils/errorUtils";

export interface SubscriptionState {
  isPro: boolean;
  tier: string | null;
  expiresAt: string | null;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  setHasHydrated: (val: boolean) => void;
  checkExpiration: () => boolean;
  refreshSubscriptionStatus: () => Promise<void>;
  updateFromCustomerInfo: (customerInfo: CustomerInfo) => void;
  setSubscription: (data: {
    isPro: boolean;
    tier?: string | null;
    expiresAt?: string | null;
  }) => void;
  reset: () => void;
}

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

export const downgradeToFree = async () => {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }

  // 1. Downgrade subscriptionStore
  useSubscriptionStore.setState({
    isPro: false,
    tier: null,
    expiresAt: null,
    isLoading: false,
    error: null,
  });

  // 2. Downgrade profileStore synchronously
  try {
    const { useProfileStore } = require("./profileStore");
    const currentProfile = useProfileStore.getState().profile;
    if (currentProfile && currentProfile.is_premium) {
      useProfileStore.setState({
        profile: { ...currentProfile, is_premium: false },
        lastFetched: Date.now(),
      });
    }
  } catch (e) {
    console.warn("[subscriptionStore] Error syncing profileStore downgrade:", e);
  }

  // 3. Invalidate history and leaderboard caches
  try {
    const { useHistoryStore } = require("../workout/historyStore");
    useHistoryStore.getState().invalidateCache();
  } catch (e) {}

  try {
    const { useLeaderboardStore } = require("../social/leaderboardStore");
    const lbState = useLeaderboardStore.getState();
    if (lbState.timeframe === "monthly") {
      lbState.setTimeframe("weekly", "guest");
    }
  } catch (e) {}
};

const scheduleExpiryTimer = (expiresAt: string | null) => {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  if (!expiresAt) return;

  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const delayMs = expiryTime - now;

  // If already expired, downgrade state immediately
  if (delayMs <= 0) {
    downgradeToFree();
    return;
  }

  // Schedule timer within max 32-bit signed int bounds (~24.8 days)
  if (delayMs < 2147483647) {
    expiryTimer = setTimeout(() => {
      downgradeToFree();
      // Also request fresh confirmation from RevenueCat
      useSubscriptionStore.getState().refreshSubscriptionStatus().catch(() => {});
    }, delayMs);
  }
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPro: false,
      tier: null,
      expiresAt: null,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setHasHydrated: (val: boolean) => set({ _hasHydrated: val }),

      checkExpiration: () => {
        const { isPro, expiresAt } = get();
        if (isPro && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
          downgradeToFree();
          return true;
        }
        return false;
      },

      updateFromCustomerInfo: (customerInfo: CustomerInfo) => {
        const activeEntitlements = customerInfo?.entitlements?.active || {};
        let activeEntitlement =
          activeEntitlements["pro"] || Object.values(activeEntitlements)[0];

        // If not in 'active', check if any entitlement in 'all' has remaining paid period (e.g. cancelled in store)
        if (!activeEntitlement || !activeEntitlement.isActive) {
          const allEntitlements = customerInfo?.entitlements?.all || {};
          const unexpired = Object.values(allEntitlements).find((ent: any) =>
            ent?.expirationDate && new Date(ent.expirationDate).getTime() > Date.now()
          );
          if (unexpired) {
            activeEntitlement = unexpired;
          }
        }

        const isUnexpired = activeEntitlement?.expirationDate
          ? new Date(activeEntitlement.expirationDate).getTime() > Date.now()
          : Boolean(activeEntitlement?.isActive);

        if (activeEntitlement && isUnexpired) {
          const expiresAt = activeEntitlement.expirationDate ?? null;
          set({
            isPro: true,
            tier: activeEntitlement.identifier || "pro",
            expiresAt,
            isLoading: false,
            error: null,
          });

          // Synchronously sync profileStore to true
          try {
            const { useProfileStore } = require("./profileStore");
            const currentProfile = useProfileStore.getState().profile;
            if (currentProfile && !currentProfile.is_premium) {
              useProfileStore.setState({
                profile: { ...currentProfile, is_premium: true },
              });
            }
          } catch (e) {}

          if (expiresAt) {
            scheduleExpiryTimer(expiresAt);
          }
        } else {
          // If no active entitlement in RevenueCat, only downgrade if an active local sub with an expiration timestamp expired
          const currentState = get();
          if (currentState.isPro && currentState.expiresAt && new Date(currentState.expiresAt).getTime() <= Date.now()) {
            downgradeToFree();
          } else {
            set({ isLoading: false, error: null });
          }
        }
      },

      setSubscription: ({ isPro, tier = null, expiresAt = null }) => {
        const isPastExpiry = expiresAt
          ? new Date(expiresAt).getTime() <= Date.now()
          : false;
        const finalIsPro = isPro && !isPastExpiry;

        if (finalIsPro) {
          set({
            isPro: true,
            tier,
            expiresAt,
          });

          // Synchronously sync profileStore to true
          try {
            const { useProfileStore } = require("./profileStore");
            const currentProfile = useProfileStore.getState().profile;
            if (currentProfile && !currentProfile.is_premium) {
              useProfileStore.setState({
                profile: { ...currentProfile, is_premium: true },
              });
            }
          } catch (e) {}

          if (expiresAt) {
            scheduleExpiryTimer(expiresAt);
          }
        } else {
          downgradeToFree();
        }
      },

      reset: () => {
        downgradeToFree();
      },

      refreshSubscriptionStatus: async () => {
        try {
          set({ isLoading: true, error: null });

          const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
          useSubscriptionStore.getState().updateFromCustomerInfo(customerInfo);
        } catch (err: any) {
          console.warn(
            "⚠️ [useSubscriptionStore] Failed to refresh subscription status:",
            err
          );
          // If network fails but local timestamp is explicitly past expiry, fail-closed
          const currentExpiresAt = useSubscriptionStore.getState().expiresAt;
          if (
            currentExpiresAt &&
            new Date(currentExpiresAt).getTime() <= Date.now()
          ) {
            downgradeToFree();
          } else {
            set({
              isLoading: false,
              error: formatUserErrorMessage(err, "Failed to fetch customer info"),
            });
          }
        }
      },
    }),
    {
      name: "replix-subscription",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isPro: state.isPro,
        tier: state.tier,
        expiresAt: state.expiresAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // On hydration check if persisted state has expired
        if (state?.expiresAt && new Date(state.expiresAt).getTime() <= Date.now()) {
          downgradeToFree();
        }
      },
    }
  )
);
