import { LeaderboardEntry } from "@/types/leaderboard.types";
import { leaderboardRepository } from "@/repositories/social/leaderboardRepository";
import { friendRepository } from "@/repositories/social/friendRepository";
import { env } from "../../config/env";

export type LeaderboardScope = "global" | "friends";
export type LeaderboardTimeframe = "weekly" | "monthly";

export const leaderboardService = {
  async fetchLeaderboard(
    scope: LeaderboardScope,
    timeframe: LeaderboardTimeframe,
    userId: string,
    page: number = 1,
    limit: number = 20,
    offsetWeeks: number = 0
  ): Promise<LeaderboardEntry[]> {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      console.warn("Supabase credentials are not configured.");
      return [];
    }

    try {
      let rawData: any[] = [];

      if (scope === "global") {
        if (timeframe === "monthly") {
          rawData = await leaderboardRepository.getPaginatedMonthly(page, limit, offsetWeeks);
        } else {
          rawData = await leaderboardRepository.getPaginatedWeekly(page, limit, offsetWeeks);
        }

        // Graceful handling if backend RPC returns { isLocked: true } or an error payload
        if (!Array.isArray(rawData)) {
          return [];
        }

        // Global RPC responses already include a deterministic rank!
        return rawData.map((row: any) => ({
          id: row.user_id || row.id,
          name: row.username || "Unknown",
          avatar: row.avatar_url ?? null,
          score: row.total_xp || row.xp || 0,
          isCurrentUser: (row.user_id || row.id) === userId,
          isPremium: row.is_premium || false,
          level: row.level || 1,
          xp: row.total_xp || row.xp || 0,
          rank: Number(row.rank), 
          country_flag: row.country_flag ?? null,
        }));

      } else {
        // FRIENDS SCOPE (Always strictly weekly, no pagination needed for friends)
        if (userId === "guest" || !userId) return [];
        const friends = await friendRepository.getFriends(userId);
        const friendIds = [...friends.map((f: any) => f.friend_id), userId];

        rawData = await leaderboardRepository.getWeeklyFriendsLeaderboard(friendIds, offsetWeeks);

        // Map and rank friends locally since it's a small dataset
        const entries: LeaderboardEntry[] = rawData.map((row: any) => ({
          id: row.user_id || row.id,
          name: row.username || "Unknown",
          avatar: row.avatar_url ?? row.avatar ?? null,
          score: Math.min(Math.floor(row.timeframe_xp ?? 0), row.xp || 0),
          isCurrentUser: (row.user_id || row.id) === userId,
          isPremium: row.is_premium || false,
          level: row.level || 1,
          xp: row.xp || 0,
          rank: 0, 
          country_flag: row.country_flag ?? null,
        }));

        entries.sort((a, b) => b.score - a.score);
        entries.forEach((e, i) => { e.rank = i + 1; });
        return entries;
      }
    } catch (error) {
      console.warn("Supabase leaderboard fetch failed:", error);
      return [];
    }
  },

  async fetchCurrentUserRank(timeframe: LeaderboardTimeframe, userId: string, offsetWeeks: number = 0): Promise<LeaderboardEntry | null> {
    if (!userId || userId === "guest") return null;
    
    try {
      const row = timeframe === "monthly" 
        ? await leaderboardRepository.getUserRankMonthly(userId, offsetWeeks)
        : await leaderboardRepository.getUserRankWeekly(userId, offsetWeeks);

      if (!row) return null;
      
      return {
        id: row.user_id || row.id,
        name: row.username || "Unknown",
        avatar: row.avatar_url ?? null,
        score: row.total_xp || row.xp || 0,
        isCurrentUser: true,
        isPremium: row.is_premium || false,
        level: row.level || 1,
        xp: row.total_xp || row.xp || 0,
        rank: Number(row.rank),
        country_flag: row.country_flag ?? null,
      };
    } catch (error) {
      console.warn("Failed to fetch current user rank:", error);
      return null;
    }
  }
};
