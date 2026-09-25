import { supabase } from "@/utils/supabase";

export const friendRepository = {
  async searchUsers(query: string, currentUserId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, total_volume, is_premium")
      .ilike("username", `%${query}%`)
      .neq("id", currentUserId)
      .limit(20);

    if (error) throw error;
    return data || [];
  },

  async sendFriendRequest(senderId: string, receiverId: string) {
    // Check if there is already an incoming request from the receiver
    const { data: existing } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("sender_id", receiverId)
      .eq("receiver_id", senderId)
      .maybeSingle();

    if (existing) {
      // Auto-accept if they already sent us a request!
      await this.acceptRequest(existing.id, receiverId, senderId);
      return { autoAccepted: true };
    }

    const { data, error } = await supabase
      .from("friend_requests")
      .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getIncomingRequests(userId: string) {
    const { data: reqs, error: reqsError } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("receiver_id", userId)
      .eq("status", "pending");

    if (reqsError) throw reqsError;
    return reqs || [];
  },

  async getOutgoingRequests(userId: string) {
    const { data: reqs, error: reqsError } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("sender_id", userId)
      .eq("status", "pending");

    if (reqsError) throw reqsError;
    return reqs || [];
  },

  async acceptRequest(requestId: string, senderId: string, receiverId: string) {
    // Delete BOTH possible directions of the request to prevent ghost requests
    await supabase.from("friend_requests").delete().or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`);
    
    const { error } = await supabase.from("friends").insert([
      { user_id: receiverId, friend_id: senderId },
      { user_id: senderId, friend_id: receiverId }
    ]);

    if (error) {
      // Fallback in case of existing row conflict
      await supabase.from("friends").upsert([
        { user_id: receiverId, friend_id: senderId },
        { user_id: senderId, friend_id: receiverId }
      ], { onConflict: "user_id,friend_id" });
    }
    return true;
  },

  async rejectRequest(requestId: string) {
    const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
    if (error) throw error;
    return true;
  },

  async getFriends(userId: string) {
    const { data, error } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", userId);
      
    if (error) throw error;
    return data || [];
  },
  
  async getProfilesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, total_volume, level, xp, created_at, is_premium, country_flag")
      .in("id", ids);
    if (error) throw error;
    return data || [];
  },

  async getFriendSingleProfile(friendId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, total_volume, level, xp, created_at, age, gender, height_cm, weight_kg, is_premium, country_flag, streak_count, longest_streak, total_workouts, last_workout_date, timezone")
      .eq("id", friendId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getFriendWorkouts(friendId: string, limit = 10) {
    const { data, error } = await supabase
      .from("workouts")
      .select("id, exercise_type, valid_rep_count, duration_seconds, created_at")
      .eq("user_id", friendId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Could not fetch friend workouts", error);
      return [];
    }
    return (data || []).map((w: any) => ({
      ...w,
      rep_count: w.valid_rep_count || 0
    }));
  },

  async getFriendAchievements(friendId: string) {
    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id, type, progress, is_completed, created_at")
      .eq("user_id", friendId)
      .eq("is_completed", true)
      .eq("type", "trophy");

    if (error) {
      console.warn("Could not fetch friend achievements", error);
      return [];
    }
    return data || [];
  },

  async getFriendRank(friendId: string): Promise<number | null> {
    const { data, error } = await supabase.rpc("get_user_rank_all_time", { target_user_id: friendId });
    if (error) {
      return null;
    }
    return data?.[0]?.rank || null;
  },

  async getFriendTrophies(friendId: string) {
    const { data, error } = await supabase
      .from("user_trophies")
      .select("rank_position, timeframe")
      .eq("user_id", friendId);
    if (error) return { 
      rank1: 0, rank2: 0, rank3: 0,
      weekly: { rank1: 0, rank2: 0, rank3: 0 },
      monthly: { rank1: 0, rank2: 0, rank3: 0 }
    };
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

  async getFriendAllWorkouts(friendId: string) {
    // Need this for streak and PRs
    const { data, error } = await supabase
      .from("workouts")
      .select("id, exercise_type, valid_rep_count, duration_seconds, created_at")
      .eq("user_id", friendId)
      .order("created_at", { ascending: false });
    
    if (error) return [];
    return data || [];
  },

  async removeFriend(userId: string, friendId: string) {
    const { error } = await supabase.rpc("remove_friend", {
      target_friend_id: friendId
    });
    
    if (error) {
      console.error("Failed to remove friend via RPC:", error);
      throw error;
    }
    return true;
  }
};
