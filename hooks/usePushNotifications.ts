import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useNotificationStore } from "@/store/notifications/notificationStore";
import { useAuthStore } from "@/store/user/authStore";

export function usePushNotifications() {
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  
  const { isAuthenticated, user } = useAuthStore();
  const requestPermission = useNotificationStore((s) => s.requestPermission);
  const initialize = useNotificationStore((s) => s.initialize);
  const permissionState = useNotificationStore((s) => s.permission);

  useEffect(() => {
    // 1. Token Registration & Syncing
    async function setupNotifications() {
      console.log("[PushNotifications] Checking auth state...", { isAuthenticated, userId: user?.id, permissionState });
      
      if (isAuthenticated && user) {
        // If we have never asked for permission, aggressively ask now since they are logged in!
        if (permissionState === "default" || permissionState === "undetermined") {
          console.log("[PushNotifications] User is authenticated but permission is undetermined. Requesting OS permission...");
          await requestPermission();
        } else {
          console.log("[PushNotifications] Permission already determined. Running standard initialization...");
          // If already granted, this will fetch the Expo token and upsert to Supabase
          await initialize();
        }
      }
    }

    setupNotifications().catch((err) => console.error("[PushNotifications] Setup failed:", err));

    // 2. Foreground Handling
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("[PushNotifications] Received in foreground:", notification);
    });

    // 3. Interaction Routing (Deep Linking)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log("[PushNotifications] User tapped notification. Route data:", data);

      if (data?.route) {
        router.push(data.route as any);
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [isAuthenticated, user, requestPermission, initialize, permissionState, router]);
}
