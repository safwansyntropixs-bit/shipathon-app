import { supabase } from "@/utils/supabase";

export const historyRepository = {
  async getWorkouts(
    userId: string,
    filterType?: string,
    start: number = 0,
    end: number = 19,
    startDate?: string,
    endDate?: string
  ) {
    try {
      let query = supabase
        .from("workouts")
        .select(`id, exercise_type, valid_rep_count, valid_active_seconds, duration_seconds, created_at, form_accuracy`)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (endDate) {
        query = query.lte("created_at", endDate);
      }

      if (filterType && filterType !== "all") {
        // TERNARY OPERATOR: Cleaner and slightly faster than reassignment
        const dbType = filterType === "push-up" ? "pushup" : filterType;
        query = query.eq("exercise_type", dbType);
      }

      query = query.range(start, end);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[historyRepository] getWorkouts Error:", error);
      throw error;
    }
  },

  async getPersonalRecords(userId: string) {
    try {
      // 1. Primary: Pure PostgreSQL database engine execution via SECURITY DEFINER RPC
      const { data, error } = await supabase.rpc("get_personal_records", { p_user_id: userId });

      if (!error && data) {
        const res = typeof data === "string" ? JSON.parse(data) : data;
        const maxPushups = Number(res?.maxPushups ?? res?.max_pushups) || 0;
        const maxSquats = Number(res?.maxSquats ?? res?.max_squats) || 0;
        const maxPlankTime = Number(res?.maxPlankTime ?? res?.max_plank_time) || 0;

        if (maxPushups > 0 || maxSquats > 0 || maxPlankTime > 0) {
          return { maxPushups, maxSquats, maxPlankTime };
        }
      }
    } catch (rpcErr) {
      console.warn("[historyRepository] get_personal_records RPC error, falling back to direct table scan:", rpcErr);
    }

    // 2. Direct table query fallback
    try {
      const { data, error } = await supabase
        .from("workouts")
        .select("exercise_type, valid_rep_count, duration_seconds, valid_active_seconds")
        .eq("user_id", userId);

      if (error) throw error;

      let maxPushups = 0;
      let maxSquats = 0;
      let maxPlankTime = 0;

      (data || []).forEach((w: any) => {
        const type = (w.exercise_type || "").toLowerCase().replace(/[-_]/g, "");
        const reps = Number(w.valid_rep_count) || 0;
        const activeSec = Number(w.valid_active_seconds) || 0;
        const durSec = Number(w.duration_seconds) || 0;

        if (type.includes("pushup")) {
          if (reps > maxPushups) maxPushups = reps;
        } else if (type.includes("squat")) {
          if (reps > maxSquats) maxSquats = reps;
        } else if (type.includes("plank")) {
          const plankTime = Math.max(activeSec, durSec);
          if (plankTime > maxPlankTime) maxPlankTime = plankTime;
        }
      });

      return { maxPushups, maxSquats, maxPlankTime };
    } catch (error) {
      console.error("[historyRepository] getPersonalRecords Error:", error);
      return { maxPushups: 0, maxSquats: 0, maxPlankTime: 0 };
    }
  },

  async getStatisticsRangeData(userId: string, range: string, offsetWeeks: number = 0) {
    try {
      // 1. Primary: Pure PostgreSQL database engine execution via SECURITY DEFINER RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_statistics_range_data", {
        p_user_id: userId,
        p_range: range,
        p_offset: offsetWeeks,
      });

      if (!rpcError && rpcData) {
        const parsed = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
        if (parsed && typeof parsed === "object" && !parsed.isLocked) {
          return {
            isLocked: false,
            labelPrefix: parsed.labelPrefix || (range === "week" ? "Weekly" : range === "month" ? "Monthly" : "Yearly"),
            reps: Number(parsed.reps) || 0,
            sets: Number(parsed.sets) || 0,
            activeDays: Number(parsed.activeDays) || 0,
            timeSec: Number(parsed.timeSec) || 0,
            timeMin: Number(parsed.timeMin) || 0,
            pushupReps: Number(parsed.pushupReps) || 0,
            squatReps: Number(parsed.squatReps) || 0,
            plankTimeSec: Number(parsed.plankTimeSec) || 0,
            plankTimeMin: Number(parsed.plankTimeMin) || 0,
            pushupAccuracy: parsed.pushupAccuracy !== undefined ? Number(parsed.pushupAccuracy) : 85,
            squatAccuracy: parsed.squatAccuracy !== undefined ? Number(parsed.squatAccuracy) : 88,
            plankAccuracy: parsed.plankAccuracy !== undefined ? Number(parsed.plankAccuracy) : 87,
            accuracy: Number(parsed.accuracy) || 0,
            trend: Array.isArray(parsed.trend) ? parsed.trend : [],
            timeTrend: Array.isArray(parsed.timeTrend) ? parsed.timeTrend : [],
            setsTrend: Array.isArray(parsed.setsTrend) ? parsed.setsTrend : [],
            repsTrend: Array.isArray(parsed.repsTrend) ? parsed.repsTrend : [],
            pushupTrend: Array.isArray(parsed.pushupTrend) ? parsed.pushupTrend : [],
            squatTrend: Array.isArray(parsed.squatTrend) ? parsed.squatTrend : [],
            plankTrend: Array.isArray(parsed.plankTrend) ? parsed.plankTrend : [],
            labels: Array.isArray(parsed.labels) ? parsed.labels : (
              range === "week" ? ["M", "T", "W", "T", "F", "S", "S"] :
              range === "month" ? ["W1", "W2", "W3", "W4"] :
              ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
            ),
          };
        }
      }

      // 2. Client-side fallback if RPC is not deployed yet, returned locked on DB, or encounters an issue
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (range === "week") {
        const currentUtcDay = now.getUTCDay();
        const daysSinceUtcMonday = currentUtcDay === 0 ? 6 : currentUtcDay - 1;

        startDate = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - daysSinceUtcMonday + (offsetWeeks * 7),
          0, 0, 0, 0
        ));
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (range === "month") {
        startDate = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + offsetWeeks,
          1, 0, 0, 0, 0
        ));
        endDate = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + offsetWeeks + 1,
          1, 0, 0, 0, 0
        ));
      } else {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));
      }

      const { data: workouts, error } = await supabase
        .from("workouts")
        .select("exercise_type, valid_rep_count, valid_active_seconds, duration_seconds, created_at, form_accuracy")
        .eq("user_id", userId)
        .gte("created_at", startDate.toISOString())
        .lt("created_at", endDate.toISOString());

      if (error) throw error;

      if (error) throw error;

      const trendLen = range === "week" ? 7 : range === "month" ? 4 : 12;
      const accuracyTrend = new Array(trendLen).fill(0);
      const timeTrend = new Array(trendLen).fill(0);
      const setsTrend = new Array(trendLen).fill(0);
      const repsTrend = new Array(trendLen).fill(0);
      const pushupTrend = new Array(trendLen).fill(0);
      const squatTrend = new Array(trendLen).fill(0);
      const plankTrend = new Array(trendLen).fill(0);
      const accCount = new Array(trendLen).fill(0);
      const activeDaysSet = new Set<string>();

      let totalReps = 0;
      let totalSets = 0;
      let totalTimeSec = 0;
      let pushupReps = 0;
      let squatReps = 0;
      let plankTimeSec = 0;
      let totalAccSum = 0;
      let totalAccCount = 0;

      (workouts || []).forEach(w => {
        const wDate = new Date(w.created_at);
        activeDaysSet.add(w.created_at ? w.created_at.split('T')[0] : wDate.toISOString().split('T')[0]);
        let index = 0;

        if (range === "week") {
          const wDay = wDate.getDay();
          index = wDay === 0 ? 6 : wDay - 1;
        } else if (range === "month") {
          const wDateDay = wDate.getDate();
          if (wDateDay <= 7) index = 0;
          else if (wDateDay <= 14) index = 1;
          else if (wDateDay <= 21) index = 2;
          else index = 3;
        } else if (range === "year") {
          index = wDate.getMonth();
        }

        const reps = Number(w.valid_rep_count) || 0;
        const dur = Number(w.duration_seconds) || 0;
        const pSec = Number(w.valid_active_seconds) || 0;
        const acc = Number(w.form_accuracy) || 0;
        const type = (w.exercise_type || "").toLowerCase().replace(/[-_]/g, "");

        totalSets++;
        totalReps += reps;
        totalTimeSec += dur;
        if (acc > 0) {
          totalAccSum += acc;
          totalAccCount++;
        }

        if (index >= 0 && index < trendLen) {
          setsTrend[index] += 1;
          timeTrend[index] += dur;
          repsTrend[index] += reps;

          if (acc > 0) {
            accuracyTrend[index] += acc;
            accCount[index] += 1;
          }

          if (type === "pushup" || type === "pushups") {
            pushupReps += reps;
            pushupTrend[index] += reps;
          } else if (type === "squat" || type === "squats") {
            squatReps += reps;
            squatTrend[index] += reps;
          } else if (type === "plank" || type === "planks") {
            const holdSec = pSec > 0 ? pSec : dur;
            plankTimeSec += holdSec;
            plankTrend[index] += holdSec;
          }
        }
      });

      for (let i = 0; i < trendLen; i++) {
        if (accCount[i] > 0) {
          accuracyTrend[i] = Math.round(accuracyTrend[i] / accCount[i]);
        }
      }

      const overallAccuracy = totalAccCount > 0 ? totalAccSum / totalAccCount : 0;

      return {
        labelPrefix: range === "week" ? "Weekly" : range === "month" ? "Monthly" : "Yearly",
        reps: totalReps,
        sets: totalSets,
        activeDays: activeDaysSet.size,
        timeSec: totalTimeSec,
        timeMin: Math.round(totalTimeSec / 60),
        pushupReps,
        squatReps,
        plankTimeSec,
        plankTimeMin: Math.round(plankTimeSec / 60),
        accuracy: Math.round(overallAccuracy),
        trend: accuracyTrend,
        timeTrend,
        setsTrend,
        repsTrend,
        pushupTrend,
        squatTrend,
        plankTrend,
        labels: range === "week"
          ? ["M", "T", "W", "T", "F", "S", "S"]
          : range === "month"
          ? ["W1", "W2", "W3", "W4"]
          : ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
      };
    } catch (error) {
      console.error("[historyRepository] getStatisticsRangeData Error:", error);
      throw error;
    }
  }
};