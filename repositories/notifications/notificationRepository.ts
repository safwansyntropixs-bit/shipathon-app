import { supabase } from "@/utils/supabase";
import { Platform } from "react-native";

export const notificationRepository = {
  async saveDeviceToken(userId: string, token: string): Promise<boolean> {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { error } = await supabase
      .from("user_devices")
      .upsert({ user_id: userId, fcm_token: token, platform }, { onConflict: 'user_id, fcm_token' });

    if (error) {
      console.error("Failed to save device token to DB:", error);
      throw error;
    }

    return true;
  },

  async getDeviceToken(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("user_devices")
      .select("fcm_token")
      .eq("user_id", userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch device token from DB:", error);
      return null;
    }

    return data?.fcm_token || null;
  }
};
