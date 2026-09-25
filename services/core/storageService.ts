import { Alert } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { StateStorage } from "zustand/middleware";

export const appStorage = createMMKV();

export const STORAGE_KEYS = {
  HAS_SEEN_ONBOARDING: "HAS_SEEN_ONBOARDING",
  REMEMBER_ME: "REMEMBER_ME_FLAG",
} as const;

let hasShownStorageAlert = false;

export const defaultStorageErrorHandler = (error: any, key?: string) => {
  console.error(`[MMKV Storage Error] Failed writing key "${key}":`, error);
  const errorMessage = (error?.message || String(error)).toLowerCase();
  const isDiskFull =
    errorMessage.includes("no space") ||
    errorMessage.includes("quota") ||
    errorMessage.includes("disk") ||
    errorMessage.includes("full") ||
    errorMessage.includes("enospc");

  if (isDiskFull && !hasShownStorageAlert) {
    hasShownStorageAlert = true;
    Alert.alert(
      "Storage Exhaustion",
      "Device storage full. Free up space to save workout and app data.",
      [{ text: "OK", onPress: () => { hasShownStorageAlert = false; } }]
    );
  }
};

/**
 * Zustand persist compatible StateStorage backed by MMKV with storage exhaustion / disk-full safeguards.
 */
export const mmkvStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return appStorage.getString(name) ?? null;
    } catch (e) {
      console.error(`[MMKV Storage] Error reading key "${name}":`, e);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      appStorage.set(name, value);
    } catch (e: any) {
      defaultStorageErrorHandler(e, name);
      throw e;
    }
  },
  removeItem: (name: string): void => {
    try {
      appStorage.remove(name);
    } catch (e) {
      console.error(`[MMKV Storage] Error removing key "${name}":`, e);
    }
  },
};

export const createMMKVStorage = (customStorage = appStorage): StateStorage => ({
  getItem: (name: string): string | null => {
    try {
      return customStorage.getString(name) ?? null;
    } catch (e) {
      console.error(`[MMKV Storage] Error reading key "${name}":`, e);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      customStorage.set(name, value);
    } catch (e: any) {
      defaultStorageErrorHandler(e, name);
      throw e;
    }
  },
  removeItem: (name: string): void => {
    try {
      customStorage.remove(name);
    } catch (e) {
      console.error(`[MMKV Storage] Error removing key "${name}":`, e);
    }
  },
});

export const storageService = {
  hasSeenOnboarding(): boolean {
    try {
      return appStorage.getBoolean(STORAGE_KEYS.HAS_SEEN_ONBOARDING) ?? false;
    } catch {
      return false;
    }
  },

  setHasSeenOnboarding(hasSeen: boolean = true): void {
    try {
      appStorage.set(STORAGE_KEYS.HAS_SEEN_ONBOARDING, hasSeen);
    } catch (e) {
      defaultStorageErrorHandler(e, STORAGE_KEYS.HAS_SEEN_ONBOARDING);
    }
  },
};
