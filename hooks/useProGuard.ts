import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useSubscriptionStore } from "../store/user/subscriptionStore";
import { useProfileStore } from "../store/user/profileStore";

export interface ProGuardConfig {
  title?: string;
  description?: string;
  buttonText?: string;
}

/**
 * Returns whether the user is definitively Pro with strict expiration validation.
 */
export function getEffectiveIsPro(): boolean {
  const subState = useSubscriptionStore.getState();
  const profileState = useProfileStore.getState();

  // 1. Explicit expiration check: if expiresAt has passed, user is NEVER Pro
  if (subState.expiresAt && new Date(subState.expiresAt).getTime() <= Date.now()) {
    return false;
  }

  // 2. Pro if subscriptionStore has active Pro OR profile has is_premium = true
  return Boolean(subState.isPro || profileState.profile?.is_premium);
}

/**
 * Reusable Action Interceptor and Pro State hook.
 * Checks subscription status with real-time expiration validation across RevenueCat and Profile stores.
 */
export function useProGuard() {
  const router = useRouter();
  const [, setTick] = useState(0);

  const subState = useSubscriptionStore();
  const profileState = useProfileStore();

  // Schedule an instant local re-render effect when expiresAt arrives in foreground
  useEffect(() => {
    if (subState.isPro && subState.expiresAt) {
      const delayMs = new Date(subState.expiresAt).getTime() - Date.now();
      if (delayMs > 0 && delayMs < 2147483647) {
        const timer = setTimeout(() => {
          setTick((t) => t + 1);
          useSubscriptionStore.getState().checkExpiration();
        }, delayMs + 50); // slight buffer to ensure Date.now() > expiresAt
        return () => clearTimeout(timer);
      } else if (delayMs <= 0) {
        useSubscriptionStore.getState().checkExpiration();
      }
    }
  }, [subState.isPro, subState.expiresAt]);

  const isSubExpired = subState.expiresAt
    ? new Date(subState.expiresAt).getTime() <= Date.now()
    : false;

  const isPro = !isSubExpired && Boolean(subState.isPro || profileState.profile?.is_premium);

  const [isProModalVisible, setIsProModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<ProGuardConfig>({});

  const openProModal = useCallback((config?: ProGuardConfig) => {
    if (config) {
      setModalConfig(config);
    }
    setIsProModalVisible(true);
  }, []);

  const closeProModal = useCallback(() => {
    setIsProModalVisible(false);
  }, []);

  /**
   * Wraps an action callback:
   * - If user is Pro & unexpired -> executes callback directly.
   * - If user is Free / Expired -> blocks execution and presents the Pro Paywall modal.
   */
  const executeIfPro = useCallback(
    (
      actionCallback: () => void | Promise<void>,
      customModalConfig?: ProGuardConfig
    ) => {
      // Re-evaluate live state at click time with active expiration check
      const isExpired = useSubscriptionStore.getState().checkExpiration();
      if (isExpired) {
        if (customModalConfig) {
          setModalConfig(customModalConfig);
        }
        setIsProModalVisible(true);
        return;
      }

      const isCurrentlyActive = getEffectiveIsPro();

      if (isCurrentlyActive) {
        return actionCallback();
      } else {
        if (customModalConfig) {
          setModalConfig(customModalConfig);
        }
        setIsProModalVisible(true);
      }
    },
    []
  );

  const handleUpgradePress = useCallback(() => {
    setIsProModalVisible(false);
    router.push("/(profile)/premium" as any);
  }, [router]);

  return {
    isPro,
    isProModalVisible,
    modalConfig,
    openProModal,
    closeProModal,
    executeIfPro,
    handleUpgradePress,
  };
}
