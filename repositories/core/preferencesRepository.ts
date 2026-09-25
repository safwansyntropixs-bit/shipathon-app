import { supabase } from "@/utils/supabase";

export interface UserPreferences {
  pushup_target: number;
  squat_target: number;
  plank_target: number;
  default_sets?: number;
  default_workout_difficulty?: string;
}

export const preferencesRepository = {
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[preferencesRepository] Error fetching user preferences:", error.message);
      throw error;
    }

    return (data?.preferences as UserPreferences) || null;
  },

  async upsertPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    const existingPrefs = await this.getPreferences(userId).catch(() => null);
    
    const mergedPreferences = {
      ...(existingPrefs || {}),
      ...preferences
    };

    const { error } = await supabase
      .from("profiles")
      .update({ preferences: mergedPreferences })
      .eq("id", userId);

    if (error) {
      console.error("[preferencesRepository] Error upserting user preferences:", error.message);
      throw error;
    }
  },
};
