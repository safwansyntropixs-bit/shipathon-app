import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import Toast from 'react-native-toast-message';
import { authService } from "../../services/user/authService";
import { analyticsService } from "../../services/core/analyticsService";
import { profileService } from "../../services/user/profileService";

import { formatUserErrorMessage } from "@/utils/errorUtils";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authError: string | null;
  authSuccess: string | null;
  isAuthenticated: boolean;
  isRecoveringPassword: boolean; 
  _authSubscription: any | null; 

  initialize: () => Promise<void>;
  setUserAndSession: (user: User | null, session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccess: (msg: string | null) => void;
  clearError: () => void;
  setRecoveringPassword: (isRecovering: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  authError: null,
  authSuccess: null,
  isAuthenticated: false,
  isRecoveringPassword: false,
  _authSubscription: null,

  setUserAndSession: (user, session) =>
    set({
      user,
      session,
      isAuthenticated: !!session,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => {
    if (!error) {
      set({ authError: null });
      return;
    }
    
    const cleanError = formatUserErrorMessage(error, "An unexpected error occurred. Please try again.");
    
    // JS Thread optimization: Let toast run asynchronously without blocking state update
    setTimeout(() => {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: cleanError
      });
    }, 0);
    
    set({ authError: cleanError, authSuccess: null });
  },

  setSuccess: (msg) => {
    if (msg) {
      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: msg
        });
      }, 0);
    }
    set({ authSuccess: msg, authError: null });
  },

  clearError: () => set({ authError: null, authSuccess: null }),

  setRecoveringPassword: (isRecovering) => set({ isRecoveringPassword: isRecovering }),

  initialize: async () => {
    // Prevent duplicate initializations if already running
    if (get()._authSubscription) return;

    try {
      set({ isLoading: true });

      // OPTIMIZATION 2: Parallel Execution
      // AsyncStorage aur Session fetch ab ek sath challenge (Cuts boot time by 50%)
      const [rememberMeFlag, session] = await Promise.all([
        AsyncStorage.getItem("REMEMBER_ME_FLAG").catch(() => null),
        authService.getSession().catch(() => null)
      ]);

      if (rememberMeFlag === "false") {
        await authService.signOut();
        // OPTIMIZATION 3: Batched State Update (Prevents multi-frame UI flicker)
        set({ session: null, user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isLoading: false // Batched here successfully
      });

      // Listen for auth changes and store the subscription for cleanup
      const subscription = authService.onAuthStateChange((event: string, newSession: Session | null, newUser: User | null) => {
        set({
          session: newSession,
          user: newUser,
          isAuthenticated: !!newSession,
        });

        // RevenueCat Identity Synchronization
        setTimeout(async () => {
          try {
            const Purchases = (await import('react-native-purchases')).default;
            if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && newUser?.id) {
              await Purchases.logIn(newUser.id);
              
              // Proactively sync entitlements with backend on app start (catches missed webhooks)
              const { premiumService } = await import('../../services/core/premiumService');
              const { useProfileStore } = await import('./profileStore');
              
              const isPremium = await premiumService.syncEntitlements(newUser.id);
              
              const currentProfile = useProfileStore.getState().profile;
              if (currentProfile && currentProfile.is_premium !== isPremium) {
                // Instantly bypass the 30-minute local cache if RevenueCat says otherwise
                await useProfileStore.getState().fetchProfile(true);
              }
              
            } else if (event === "SIGNED_OUT") {
              if (!(await Purchases.isAnonymous())) {
                await Purchases.logOut();
              }
            }
          } catch (e) {
            console.error("RevenueCat sync error:", e);
          }
        }, 0);

        if (newSession && newUser) {
          // Offload analytics to background so it doesn't interrupt UI frame rendering
          setTimeout(() => {
            // Sync timezone so database calculates streaks correctly based on exact location
            profileService.syncUserTimezone(newUser.id);

            analyticsService.identifyUser(newUser.id);
            analyticsService.trackEvent("auth_completed", {
              method: "email",
              was_guest: false,
            });
          }, 0);
        }
      });
      
      // Save subscription to prevent memory leaks
      set({ _authSubscription: subscription });

    } catch (error: any) {
      console.error("Error initializing auth:", error);
      // Batched update on failure
      set({ authError: formatUserErrorMessage(error, "Failed to initialize authentication"), isLoading: false }); 
    }
  },

  signOut: async () => {
    try {
      // OPTIMIZATION: Clear memory leak listener on sign out
      const sub = get()._authSubscription;
      if (sub?.unsubscribe) {
        sub.unsubscribe();
      }
      
      await authService.signOut();
      
      set({ 
        session: null, 
        user: null, 
        isAuthenticated: false,
        _authSubscription: null 
      });

      // Reset all other stores to prevent cross-session data leaks
      const { clearAllStores } = require('../core/clearStores');
      clearAllStores();
      
    } catch (error: any) {
      console.error("Error signing out:", error);
    }
  },
}));