import { supabase } from "@/utils/supabase";

export const streakRepository = {
  /**
   * Fetches all workouts for a user to calculate longest streak and achievements.
   * Sorted descending by created_at.
   */
  async getUserWorkouts(userId: string) {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  },

  /**
   * O(1) direct profile fetch for precomputed streak and workout aggregates.
   */
  async getUserProfileStreakAggregates(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("streak_count, longest_streak, total_workouts, total_volume, last_workout_date, timezone")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[streakRepository] getUserProfileStreakAggregates error:", error);
      return null;
    }

    return data;
  },
};
