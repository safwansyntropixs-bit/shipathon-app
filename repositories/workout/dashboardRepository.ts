import { supabase } from "@/utils/supabase";

export const dashboardRepository = {
  // 1. SIMPLE PROFILE FETCH
  async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        // OPTIMIZATION: Removed 'total_volume' because your RPC already handles it!
        // Just fetching the username saves network payload size.
        .select("username")
        .eq("id", userId)
        .maybeSingle(); // Better than .single() as it doesn't throw on 0 rows

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[dashboardRepository] Failed to fetch user profile:", error);
      return null;
    }
  },

  // 2. THE PROFESSIONAL DATABASE CALL (Replacing getUserWorkouts)
  async getDashboardMetrics(userId: string) {
    try {
      const { data, error } = await supabase.rpc("get_dashboard_metrics", {
        p_user_id: userId
      });

      if (!error && data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
      if (error) {
        console.warn("[dashboardRepository] RPC get_dashboard_metrics Error, falling back to direct table scan:", error);
      }
    } catch (error) {
      console.warn("[dashboardRepository] RPC get_dashboard_metrics Exception, falling back to direct table scan:", error);
    }

    // Direct table fallback if RPC is not deployed or encounters an issue
    try {
      const { data: workouts, error: wError } = await supabase
        .from("workouts")
        .select("exercise_type, valid_rep_count, valid_active_seconds, duration_seconds, form_accuracy, created_at")
        .eq("user_id", userId);

      if (wError) throw wError;

      let pushupReps = 0;
      let squatReps = 0;
      let plankTimeMin = 0;
      let totalTimeHr = 0;
      let totalTimeMin = 0;
      let formScoreSum = 0;
      let formScoreCount = 0;

      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      let weeklySets = 0;
      let weeklyReps = 0;
      let weeklyPushupAccSum = 0;
      let weeklyPushupCount = 0;
      let weeklySquatAccSum = 0;
      let weeklySquatCount = 0;

      const dayAccSums = [0, 0, 0, 0, 0, 0, 0];
      const dayAccCounts = [0, 0, 0, 0, 0, 0, 0];

      (workouts || []).forEach((w: any) => {
        const reps = Number(w.valid_rep_count) || 0;
        const activeSec = Number(w.valid_active_seconds) || 0;
        const durSec = Number(w.duration_seconds) || 0;
        const acc = Number(w.form_accuracy) || 0;
        const createdAt = new Date(w.created_at).getTime();

        const type = (w.exercise_type || "").toLowerCase().replace(/[-_]/g, "");
        if (type.includes("pushup")) pushupReps += reps;
        else if (type.includes("squat")) squatReps += reps;
        else if (type.includes("plank")) plankTimeMin += activeSec / 60;

        totalTimeMin += durSec / 60;
        totalTimeHr += durSec / 3600;

        if (acc > 0) {
          formScoreSum += acc;
          formScoreCount += 1;
        }

        if (createdAt >= oneWeekAgo) {
          weeklySets += 1;
          weeklyReps += reps;
          if (type.includes("pushup") && acc > 0) {
            weeklyPushupAccSum += acc;
            weeklyPushupCount += 1;
          } else if (type.includes("squat") && acc > 0) {
            weeklySquatAccSum += acc;
            weeklySquatCount += 1;
          }

          const dayIdx = new Date(createdAt).getDay();
          if (acc > 0) {
            dayAccSums[dayIdx] += acc;
            dayAccCounts[dayIdx] += 1;
          }
        }
      });

      const accuracyTrend = dayAccSums.map((sum, i) => dayAccCounts[i] > 0 ? Math.round(sum / dayAccCounts[i]) : 0);

      return {
        pushupReps,
        squatReps,
        plankTimeMin,
        totalTimeHr,
        totalTimeMin,
        totalVolume: 0,
        weeklySets,
        weeklyReps,
        weeklyPushupAccuracy: weeklyPushupCount > 0 ? Math.round(weeklyPushupAccSum / weeklyPushupCount) : 85,
        weeklySquatAccuracy: weeklySquatCount > 0 ? Math.round(weeklySquatAccSum / weeklySquatCount) : 88,
        formScore: formScoreCount > 0 ? Math.round(formScoreSum / formScoreCount) : 0,
        accuracyTrend
      };
    } catch (fallbackError) {
      console.error("[dashboardRepository] Fallback direct query error:", fallbackError);
      return {
        pushupReps: 0,
        squatReps: 0,
        plankTimeMin: 0,
        totalTimeHr: 0,
        totalTimeMin: 0,
        totalVolume: 0,
        weeklySets: 0,
        weeklyReps: 0,
        weeklyPushupAccuracy: 85,
        weeklySquatAccuracy: 88,
        formScore: 0,
        accuracyTrend: [0, 0, 0, 0, 0, 0, 0]
      };
    }
  },

  // 3. FETCH DAILY METRICS FOR SPECIFIC DATE (DEFAULT TODAY)
  async getDailyMetrics(userId: string, targetDate: Date = new Date()) {
    try {
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("workouts")
        .select("exercise_type, valid_rep_count, valid_active_seconds")
        .eq("user_id", userId)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString());

      if (error) throw error;

      let todayPushups = 0;
      let todaySquats = 0;
      let todayPlankMin = 0;

      data?.forEach(w => {
        if (w.exercise_type === "pushup") todayPushups += w.valid_rep_count || 0;
        if (w.exercise_type === "squat") todaySquats += w.valid_rep_count || 0;
        if (w.exercise_type === "plank") todayPlankMin += (w.valid_active_seconds || 0) / 60;
      });

      const todayWorkouts = data?.length || 0;
      return { todayPushups, todaySquats, todayPlankMin, todayWorkouts };
    } catch (error) {
      console.error("[dashboardRepository] Error fetching today metrics:", error);
      return { todayPushups: 0, todaySquats: 0, todayPlankMin: 0, todayWorkouts: 0 };
    }
  },

  // 4. FETCH TOTAL SESSIONS FOR LIFETIME GRINDS
  async getTotalSessions(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("total_workouts")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      return data?.total_workouts ?? 0;
    } catch (error) {
      console.error("[dashboardRepository] Error fetching total workouts:", error);
      return 0;
    }
  }
};