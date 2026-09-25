import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { notificationRepository } from "../../repositories/notifications/notificationRepository";

export class NotificationService {
  async requestPermission(): Promise<Notifications.NotificationPermissionsStatus> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return await Notifications.getPermissionsAsync();
  }

  async registerDeviceToken(userId: string): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn("Must use physical device for Push Notifications");
      return null;
    }

    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("[NOTIFICATION_SERVICE] Cannot register device, permission not granted.");
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      if (!projectId) {
        throw new Error("Project ID not found in app.config.js");
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenData.data;
      console.log(`[NOTIFICATION_SERVICE] Successfully generated Expo Push Token: ${token}`);

      // Save token to DB via repository
      console.log(`[NOTIFICATION_SERVICE] Upserting token to Supabase for user: ${userId}`);
      await notificationRepository.saveDeviceToken(userId, token);
      console.log(`[NOTIFICATION_SERVICE] Token successfully saved to Supabase user_devices!`);

      return token;
    } catch (error: any) {
      console.error("[NOTIFICATION_SERVICE] FATAL Failed to register device token. Error:", error?.message || error);
      return null;
    }
  }
}

export const notificationService = new NotificationService();
