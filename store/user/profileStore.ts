import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { profileService } from "../../services/user/profileService";
import { formatUserErrorMessage } from "@/utils/errorUtils";
import { Profile, UserPreferences, UserTrophiesData } from "../../types/user.types";
import { useAuthStore } from "./authStore";

const defaultTrophyCounts: UserTrophiesData = {
  rank1: 0,
  rank2: 0,
  rank3: 0,
  weekly: { rank1: 0, rank2: 0, rank3: 0 },
  monthly: { rank1: 0, rank2: 0, rank3: 0 },
};

interface ProfileState {
  profile: Profile | null;
  preferences: UserPreferences;
  trophyCounts: UserTrophiesData;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // OPTIMIZATION 1: Cache and Mutex locks to save Database Egress
  lastFetched: number | null;
  _activeRequest: Promise<Profile> | null;
  previousLevel: number | null;

  setHasHydrated: (val: boolean) => void;
  fetchProfile: (forceRefresh?: boolean) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  clearProfile: () => void;
  clearPreviousLevel: () => void;
  lastProfileEditTimestamp: number | null;
  setLastProfileEditTimestamp: (time: number) => void;
}

const defaultPreferences: UserPreferences = {
  highRes: false,
  haptics: true,
  voiceCoach: true,
  privacyLock: true,
  theme: "dark",
  prepTimer: 5,
};

// CACHE EXPIRY: Profile bohat kam change hoti hai, isliye 30 minutes ka lambaa cache!
const CACHE_TTL = 30 * 60 * 1000;

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      preferences: defaultPreferences,
      trophyCounts: defaultTrophyCounts,
      isLoading: false,
      error: null,
      _hasHydrated: false,
      lastFetched: null,
      _activeRequest: null,
      previousLevel: null,
      lastProfileEditTimestamp: null,

      setHasHydrated: (val: boolean) => set({ _hasHydrated: val }),
      setLastProfileEditTimestamp: (time) => set({ lastProfileEditTimestamp: time }),

      clearPreviousLevel: () => set({ previousLevel: null }),

      fetchProfile: async (forceRefresh = false) => {
        const { session } = useAuthStore.getState();
        if (!session?.user?.id) return;

        const { lastFetched, _activeRequest } = get();
        const now = Date.now();

        // 1. INSTANT CACHE RETURN (Saves Supabase Reads)
        if (!forceRefresh && lastFetched && (now - lastFetched < CACHE_TTL)) {
          return;
        }

        // 2. MUTEX LOCK (Stops parallel duplicate requests)
        if (_activeRequest && !forceRefresh) {
          await _activeRequest;
          return;
        }

        // 3. OPTIMISTIC LOADING
        const isFirstLoad = !lastFetched;
        if (isFirstLoad) {
          set({ isLoading: true, error: null });
        } else {
          set({ error: null });
        }

        try {
          const fetchPromise = profileService.getProfile(session.user.id);
          set({ _activeRequest: fetchPromise });

          const [profile, trophyCounts] = await Promise.all([
            fetchPromise,
            profileService.getTrophies(session.user.id)
          ]);

          set({
            profile,
            trophyCounts,
            isLoading: false,
            lastFetched: Date.now(),
            _activeRequest: null
          });
        } catch (error: any) {
          console.error("Error fetching profile:", error);
          set({
            error: formatUserErrorMessage(error, "Failed to fetch profile"),
            isLoading: false,
            _activeRequest: null
          });
        }
      },

      updateProfile: async (updates) => {
        const { session } = useAuthStore.getState();
        if (!session?.user?.id) return;

        const previousProfile = get().profile;
        let newPreviousLevel = get().previousLevel;

        if (updates.level !== undefined && previousProfile && updates.level > previousProfile.level) {
          newPreviousLevel = previousProfile.level;
        }

        // 🚀 OPTIMIZATION 2: OPTIMISTIC UI UPDATE
        // UI instantly update ho jayegi, JS thread par zero block, zero loading spinners!
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null,
          previousLevel: newPreviousLevel,
          error: null
        }));

        try {
          // Background me Supabase ko silently data bhej do
          const updatedProfile = await profileService.updateProfile(
            session.user.id,
            updates,
          );
          // Backend ne process kar ke bheja (e.g. string formatting ya avatars), toh update kardo
          set({ profile: updatedProfile, lastFetched: Date.now() });
        } catch (error: any) {
          console.error("Error updating profile:", error);

          // 🚀 ROLLBACK: Agar net drop ho gaya ya Supabase fail hua, toh profile automatically wapas theek ho jayegi
          set({
            profile: previousProfile,
            error: formatUserErrorMessage(error, "Failed to update profile")
          });
          throw error; // Bubble up taake UI component Toast message dikha sake
        }
      },

      updatePreferences: (updates) => {
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        }));
      },

      clearProfile: () => {
        set({
          profile: null,
          preferences: defaultPreferences,
          trophyCounts: defaultTrophyCounts,
          error: null,
          lastFetched: null,
          _activeRequest: null,
          previousLevel: null,
          lastProfileEditTimestamp: null
        });
      },
    }),
    {
      name: "replix-preferences", // Local Storage key
      partialize: (state) => ({
        profile: state.profile,
        preferences: state.preferences,
        lastProfileEditTimestamp: state.lastProfileEditTimestamp
      }),
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);