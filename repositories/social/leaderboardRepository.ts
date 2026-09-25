import { supabase } from "@/utils/supabase";

export const leaderboardRepository = {
  // --- NEW RPC CALLS FOR GLOBAL LEADERBOARDS ---
  
  async getPaginatedAllTime(page: number, limit: number) {
    const { data, error } = await supabase.rpc("get_paginated_all_time", {
      page_number: page,
      page_size: limit,
    });
    if (error) throw error;
    return data || [];
  },

  async getUserRankAllTime(userId: string) {
    const { data, error } = await supabase.rpc("get_user_rank_all_time", {
      target_user_id: userId,
    });
    if (error) throw error;
    return data?.[0] || null;
  },

  async getPaginatedWeekly(page: number, limit: number, offsetWeeks: number = 0) {
    const { data, error } = await supabase.rpc("get_paginated_weekly", {
      page_number: page,
      page_size: limit,
      offset_weeks: offsetWeeks,
    });
    if (error) throw error;
    return data || [];
  },

  async getUserRankWeekly(userId: string, offsetWeeks: number = 0) {
    const { data, error } = await supabase.rpc("get_user_rank_weekly", {
      target_user_id: userId,
      offset_weeks: offsetWeeks,
    });
    if (error) throw error;
    return data?.[0] || null;
  },

  async getPaginatedMonthly(page: number, limit: number, offsetMonths: number = 0) {
    const { data, error } = await supabase.rpc("get_paginated_monthly", {
      page_number: page,
      page_size: limit,
      offset_months: offsetMonths,
    });
    if (error) throw error;
    return data || [];
  },

  async getUserRankMonthly(userId: string, offsetMonths: number = 0) {
    const { data, error } = await supabase.rpc("get_user_rank_monthly", {
      target_user_id: userId,
      offset_months: offsetMonths,
    });
    if (error) throw error;
    return data?.[0] || null;
  },

  // --- EXISTING LOGIC FOR FRIENDS SCOPE (Weekly only) ---

  async getProfilesByIds(userIds: string[]) {
    if (!userIds || userIds.length === 0) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, total_volume, is_premium, level, xp")
      .not("username", "is", null)
      .in("id", userIds)
      .order("xp", { ascending: false })
      .limit(50);
      
    if (error) throw error;
    return (data || [])
      .filter((p: any) => p.username && p.username.trim() !== "")
      .map((p: any) => ({ ...p, user_id: p.id }));
  },

  async getWeeklyFriendsLeaderboard(userIds: string[], offsetWeeks: number = 0) {
    if (!userIds || userIds.length === 0) return [];
    
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    const day = startDate.getUTCDay();
    const diff = startDate.getUTCDate() - day + (day === 0 ? -6 : 1) + (offsetWeeks * 7);
    startDate.setUTCDate(diff);

    let endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 7);

    let query = supabase
      .from("xp_transactions")
      .select("user_id, amount")
      .gte("created_at", startDate.toISOString())
      .in("user_id", userIds);
      
    if (offsetWeeks < 0) {
       query = query.lt("created_at", endDate.toISOString());
    }

    const { data: xpData, error: xpError } = await query;
      
    if (xpError) throw xpError;

    const userMap: Record<string, any> = {};
    for (const w of (xpData || [])) {
      if (!userMap[w.user_id]) {
        userMap[w.user_id] = { user_id: w.user_id, timeframe_xp: 0 };
      }
      userMap[w.user_id].timeframe_xp += (w.amount || 0);
    }

    const { data: pData } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, is_premium, total_volume, level, xp")
      .not("username", "is", null)
      .in("id", userIds);

    const profilesData = (pData || []).filter((p: any) => p.username && p.username.trim() !== "");

    for (const p of profilesData) {
      if (userMap[p.id]) {
        Object.assign(userMap[p.id], p);
      } else {
        userMap[p.id] = { ...p, user_id: p.id, timeframe_xp: 0 };
      }
    }

    const aggregated = Object.values(userMap).filter(item => item.username && item.username !== "Unknown");
    aggregated.sort((a, b) => b.timeframe_xp - a.timeframe_xp);
    return aggregated.slice(0, 50);
  }
};
