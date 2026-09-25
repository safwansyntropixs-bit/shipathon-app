import { streakRepository } from "@/repositories/gamification/streakRepository";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: "Award" | "Sparkles" | "Flame";
  achieved: boolean;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  totalReps: number;
  achievements: Achievement[];
  missedDay: boolean;
  lastWorkoutDate?: string | null;
}

/**
 * Real-time dynamic streak evaluator.
 * A streak remains active if the user worked out TODAY or YESTERDAY in their local timezone.
 * If the user missed yesterday or hasn't worked out in 2+ days, the streak is calculated as 0.
 */
export function calculateActiveStreak(
  storedStreak: number = 0,
  lastWorkoutDate: string | null = null,
  userTimezone?: string | null
): number {
  if (!lastWorkoutDate || storedStreak <= 0) {
    return 0;
  }

  try {
    let lastDateStr = lastWorkoutDate;
    if (lastWorkoutDate.includes("T")) {
      lastDateStr = lastWorkoutDate.split("T")[0];
    }

    // Determine target timezone (IANA format e.g. "America/New_York", "Europe/London", "Asia/Tokyo")
    let tz = userTimezone;
    if (!tz) {
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        tz = "UTC";
      }
    }

    // Format today and yesterday in the user's specific IANA timezone (en-CA formats as YYYY-MM-DD)
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }

    const todayStr = formatter.format(new Date());
    const yesterdayStr = formatter.format(new Date(Date.now() - 86400000));

    // If the user worked out today or yesterday in their local timezone -> streak is intact
    if (lastDateStr === todayStr || lastDateStr === yesterdayStr) {
      return storedStreak;
    }

    // More than 1 day missed -> streak lapsed
    return 0;
  } catch (e) {
    return 0;
  }
}

export const streakService = {
  async fetchStreakData(userId: string): Promise<StreakData> {
    try {
      // 1. O(1) FAST PATH: Read precomputed profile aggregations with dynamic timezone decay
      const profile = await streakRepository.getUserProfileStreakAggregates(userId);

      if (profile) {
        const currentStreak = calculateActiveStreak(
          profile.streak_count || 0,
          profile.last_workout_date,
          profile.timezone
        );
        const longestStreak = profile.longest_streak || 0;
        const totalSessions = profile.total_workouts || 0;
        const totalReps = profile.total_volume || 0;
        const missedDay = currentStreak === 0 && (longestStreak > 0 || totalSessions > 0);

        return {
          currentStreak,
          longestStreak,
          totalSessions,
          totalReps,
          achievements: [],
          missedDay,
          lastWorkoutDate: profile.last_workout_date || null,
        };
      }

      // 2. FALLBACK PATH: If profile row is not yet initialized, calculate from workouts
      const workouts = await streakRepository.getUserWorkouts(userId);

      if (!workouts || workouts.length === 0) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          totalSessions: 0,
          totalReps: 0,
          achievements: [],
          missedDay: false,
          lastWorkoutDate: null,
        };
      }

      const totalSessions = workouts.length;
      let totalReps = 0;

      const activeDays = new Set<string>();
      for (const w of workouts) {
        totalReps += w.valid_rep_count || 0;
        const dateStr = new Date(w.created_at).toDateString();
        activeDays.add(dateStr);
      }

      const sortedDays = Array.from(activeDays)
        .map((d) => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime());

      let longestStreak = 0;
      let currentCalc = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let missedDay = false;
      const mostRecentDate = sortedDays[0];
      if (mostRecentDate < yesterday) {
        missedDay = true;
      }

      let currentStreak = 0;
      if (!missedDay && sortedDays.length > 0) {
        currentStreak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
          const diff = (sortedDays[i - 1].getTime() - sortedDays[i].getTime()) / (1000 * 60 * 60 * 24);
          if (Math.round(diff) === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      for (let i = 0; i < sortedDays.length; i++) {
        if (i === 0) {
          currentCalc = 1;
        } else {
          const diff =
            (sortedDays[i - 1].getTime() - sortedDays[i].getTime()) /
            (1000 * 60 * 60 * 24);
          if (Math.round(diff) === 1) {
            currentCalc++;
          } else {
            currentCalc = 1;
          }
        }
        if (currentCalc > longestStreak) {
          longestStreak = currentCalc;
        }
      }

      return {
        currentStreak,
        longestStreak,
        totalSessions,
        totalReps,
        achievements: [],
        missedDay,
        lastWorkoutDate: sortedDays[0]?.toISOString() || null,
      };
    } catch (error) {
      console.error("StreakService Error:", error);
      throw error;
    }
  },
};
