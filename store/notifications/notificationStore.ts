import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { notificationService } from "../../services/notifications/notificationService";
import { useAuthStore } from "../user/authStore";

interface NotificationPreferences {
  workoutReminders: boolean;
  friendActivity: boolean;
  streakAlerts: boolean;
}

interface NotificationState {
  permission: "granted" | "denied" | "undetermined" | "default";
  fcmToken: string | null;
  preferences: NotificationPreferences;

  initialize: () => Promise<void>;
  requestPermission: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      permission: "default",
      fcmToken: null,
      preferences: {
        workoutReminders: true,
        friendActivity: true,
        streakAlerts: true,
      },

      initialize: async () => {
        const { permission } = get();
        // If we previously had granted, let's make sure our token is registered
        if (permission === "granted") {
          const user = useAuthStore.getState().user;
          if (user) {
            const token = await notificationService.registerDeviceToken(
              user.id,
            );
            set({ fcmToken: token });
          }
        }
      },

      requestPermission: async () => {
        try {
          const statusObj = await notificationService.requestPermission();
          set({ permission: statusObj.status as any });

          if (statusObj.status === "granted") {
            const user = useAuthStore.getState().user;
            if (user) {
              const token = await notificationService.registerDeviceToken(
                user.id,
              );
              set({ fcmToken: token });
            }
          }
        } catch (error) {
          console.error("Failed to request notification permission:", error);
        }
      },

      updatePreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        }));
      },
    }),
    {
      name: "replix-notifications",
      partialize: (state) => ({
        preferences: state.preferences,
        permission: state.permission,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
