import { dashboardRepository } from "@/repositories/workout/dashboardRepository";

export interface DashboardData {
  username?: string;
  pushupReps: number;
  formScore: number;
  plankTimeMin: number;
  totalVolume: number;
  totalTimeHr: number;
  squatReps: number;
  accuracyTrend: number[];
  weeklySets: number;
  totalTimeMin: number;
  weeklyReps: number;
  weeklyPushupAccuracy: number;
  weeklySquatAccuracy: number;
  todayPushupReps?: number;
  todaySquatReps?: number;
  todayPlankTimeMin?: number;
  todayWorkouts?: number;
  totalSessions: number;
}

export const dashboardService = {
  async fetchDashboardStats(userId: string): Promise<DashboardData> {
    try {
      console.log("[dashboardService] Fetching extreme optimized stats from RPC");
      
      // 1. ZERO JS LOOPS: Hum saara calculation Supabase (PostgreSQL) engine par chor rahe hain.
      // 2. NETWORK ECONOMY: Hazaron rows mangwane ke bajaye, sirf 3 requests jayengi.
      const [profile, stats, todayStats, totalSessions] = await Promise.all([
        dashboardRepository.getUserProfile(userId),
        dashboardRepository.getDashboardMetrics(userId), // <-- Calling your custom RPC here
        dashboardRepository.getDailyMetrics(userId),
        dashboardRepository.getTotalSessions(userId)
      ]);

      console.log("[dashboardService] Fetch done - 0% JS Thread overhead");

      const parsedStats = typeof stats === "string" ? JSON.parse(stats) : (stats || {});
      const parsedToday = todayStats || { todayPushups: 0, todaySquats: 0, todayPlankMin: 0, todayWorkouts: 0 };

      // RPC directly returns the pre-calculated numbers, we just map them safely.
      return {
        username: profile?.username || undefined,
        pushupReps: Number(parsedStats.pushupReps) || 0,
        squatReps: Number(parsedStats.squatReps) || 0,
        plankTimeMin: Number(parsedStats.plankTimeMin) || 0,
        totalTimeHr: Number(parsedStats.totalTimeHr) || 0,
        totalVolume: Number(parsedStats.totalVolume) || 0,
        formScore: Number(parsedStats.formScore) || 0,
        accuracyTrend: Array.isArray(parsedStats.accuracyTrend) ? parsedStats.accuracyTrend : [0, 0, 0, 0, 0, 0, 0],
        weeklySets: Number(parsedStats.weeklySets) || 0,
        totalTimeMin: Number(parsedStats.totalTimeMin) || 0, 
        weeklyReps: Number(parsedStats.weeklyReps) || 0,
        weeklyPushupAccuracy: Number(parsedStats.weeklyPushupAccuracy) || 85,
        weeklySquatAccuracy: Number(parsedStats.weeklySquatAccuracy) || 88,
        todayPushupReps: Number(parsedToday.todayPushups) || 0,
        todaySquatReps: Number(parsedToday.todaySquats) || 0,
        todayPlankTimeMin: Number(parsedToday.todayPlankMin) || 0,
        todayWorkouts: Number(parsedToday.todayWorkouts) || 0,
        totalSessions: Number(totalSessions) || 0
      };
    } catch (error) {
      console.error("[dashboardService] Error computing dashboard stats:", error);
      throw error; // Let the robust Zustand store handle the error state
    }
  },

  async fetchDailyStats(userId: string, date: Date): Promise<Partial<DashboardData>> {
    try {
      const dailyStats = await dashboardRepository.getDailyMetrics(userId, date);
      return {
        todayPushupReps: dailyStats.todayPushups,
        todaySquatReps: dailyStats.todaySquats,
        todayPlankTimeMin: dailyStats.todayPlankMin,
        todayWorkouts: dailyStats.todayWorkouts
      };
    } catch (error) {
      console.error("[dashboardService] Error fetching daily stats:", error);
      throw error;
    }
  }
};