import { supabase } from "@/utils/supabase";
import { Profile } from "../../types/user.types";
import * as Localization from 'expo-localization';
import { calculateActiveStreak } from "../gamification/streakService";

export const profileService = {
  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      // Create a default profile object if it doesn't exist yet (handled by trigger in production)
      if (error.code === "PGRST116") {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          return {
            id: userId,
            email: userData.user.email || "",
            username: userData.user.user_metadata?.full_name || "New User",
            is_premium: false,
            streak_count: 0,
            longest_streak: 0,
            total_workouts: 0,
            level: 1,
            xp: 0,
            created_at: new Date().toISOString(),
          };
        }
      }
      throw error;
    }
    
    const activeStreak = calculateActiveStreak(
      data.streak_count || 0,
      data.last_workout_date,
      data.timezone
    );

    return {
      ...data,
      total_workouts: data.total_workouts || 0,
      longest_streak: data.longest_streak || 0,
      streak_count: activeStreak,
    };
  },

  async updateProfile(
    userId: string,
    updates: Partial<Profile>,
  ): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Profile doesn't exist yet, create it with defaults + updates
      const { data: userData } = await supabase.auth.getUser();
      const newProfile = {
        id: userId,
        email: userData.user?.email || "",
        username: userData.user?.user_metadata?.full_name || "New User",
        is_premium: false,
        streak_count: 0,
        total_volume: 0,
        total_workouts: 0,
        ...updates,
      };

      const { data: insertData, error: insertError } = await supabase
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();

      if (insertError) throw insertError;
      return insertData;
    }

    return data;
  },

  async getTrophies(userId: string) {
    const { data, error } = await supabase
      .from('user_trophies')
      .select('rank_position, timeframe')
      .eq('user_id', userId);
      
    if (error) {
      console.warn("Failed to fetch trophies:", error);
      return { 
        rank1: 0, rank2: 0, rank3: 0,
        weekly: { rank1: 0, rank2: 0, rank3: 0 },
        monthly: { rank1: 0, rank2: 0, rank3: 0 }
      };
    }

    const trophies = data || [];
    
    return {
      rank1: trophies.filter((t: any) => t.rank_position === 1).length,
      rank2: trophies.filter((t: any) => t.rank_position === 2).length,
      rank3: trophies.filter((t: any) => t.rank_position === 3).length,
      weekly: {
        rank1: trophies.filter((t: any) => t.rank_position === 1 && t.timeframe !== 'monthly').length,
        rank2: trophies.filter((t: any) => t.rank_position === 2 && t.timeframe !== 'monthly').length,
        rank3: trophies.filter((t: any) => t.rank_position === 3 && t.timeframe !== 'monthly').length,
      },
      monthly: {
        rank1: trophies.filter((t: any) => t.rank_position === 1 && t.timeframe === 'monthly').length,
        rank2: trophies.filter((t: any) => t.rank_position === 2 && t.timeframe === 'monthly').length,
        rank3: trophies.filter((t: any) => t.rank_position === 3 && t.timeframe === 'monthly').length,
      }
    };
  },

  async syncUserTimezone(userId: string) {
    try {
      // expo-localization safely grabs the exact IANA timezone string from the OS (e.g. "America/New_York", "Europe/London", "Asia/Tokyo")
      const calendars = Localization.getCalendars();
      const deviceTimezone = calendars[0]?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      const { error } = await supabase
        .from('profiles')
        .update({ timezone: deviceTimezone })
        .eq('id', userId);

      if (error) {
        console.error('Failed to sync timezone:', error.message);
        return;
      }

      console.log(`Timezone synced to Supabase: ${deviceTimezone}`);
    } catch (err) {
      console.error('Timezone sync error:', err);
    }
  },
};
