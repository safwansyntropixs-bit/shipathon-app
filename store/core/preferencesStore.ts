import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { UserPreferences } from "../../repositories/core/preferencesRepository";
import { mmkvStorage } from "../../services/core/storageService";
import { preferencesService } from "../../services/core/preferencesService";
import { networkService } from "../../services/core/networkService";

export const defaultPreferences: UserPreferences = {
  pushup_target: 50,
  squat_target: 30,
  plank_target: 120,
  default_sets: 3,
  default_workout_difficulty: "Easy",
};

interface PreferencesState {
  preferences: UserPreferences;
  isLoading: boolean;
  lastFetched: number | null;

  fetchPreferences: (userId: string, forceRefresh?: boolean) => Promise<void>;
  updatePreference: (userId: string, exerciseKey: string, value: number) => Promise<void>;
  updateMultiplePreferences: (userId: string, partialPrefs: Partial<UserPreferences>) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,
      isLoading: false,
      lastFetched: null,

      fetchPreferences: async (userId: string, forceRefresh = false) => {
        // 1. If offline, instantly return local MMKV-persisted preferences without overwriting
        if (!networkService.isInternetReachable()) {
          return;
        }

        const { lastFetched } = get();
        const now = Date.now();
        // 5-minute cache TTL
        if (!forceRefresh && lastFetched && (now - lastFetched < 5 * 60 * 1000)) {
          return;
        }

        try {
          const remotePrefs = await preferencesService.getUserPreferences(userId);
          if (remotePrefs) {
            set((state) => ({
              preferences: {
                ...state.preferences,
                ...remotePrefs,
              },
              isLoading: false,
              lastFetched: Date.now(),
            }));
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.warn("[preferencesStore] Failed to refresh preferences, keeping local cache:", error);
          set({ isLoading: false });
        }
      },

      updatePreference: async (userId: string, exerciseKey: string, value: number) => {
        try {
          const currentPrefs = get().preferences || defaultPreferences;
          const key = `${exerciseKey}_target` as keyof UserPreferences;
          const updatedPrefs = { ...currentPrefs, [key]: value };

          // 1. Optimistic update (instantly persists to MMKV disk)
          set({ preferences: updatedPrefs });

          // 2. Queue into offline outbox
          await preferencesService.updateUserPreferences(userId, { [key]: value });
        } catch (error) {
          console.error("Failed to update preference:", error);
        }
      },

      updateMultiplePreferences: async (userId: string, partialPrefs: Partial<UserPreferences>) => {
        try {
          const currentPrefs = get().preferences || defaultPreferences;
          const updatedPrefs = { ...currentPrefs, ...partialPrefs };

          // 1. Optimistic update
          set({ preferences: updatedPrefs });

          // 2. Queue into offline outbox
          await preferencesService.updateUserPreferences(userId, partialPrefs);
        } catch (error) {
          console.error("Failed to update multiple preferences:", error);
        }
      },
    }),
    {
      name: "replix-preferences-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
