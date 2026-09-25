import { historyRepository } from "../../repositories/workout/historyRepository";

export interface HistoryItem {
  id: string;
  exercise: string;
  reps: number;
  accuracy: number;
  date: string;
  duration?: string;
  volume?: string;
  calories?: number;
  timestamp: number;
  monthYear?: string;
  plankSeconds?: number;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'dead_letter';
}

export interface PersonalRecords {
  maxPushups: number;
  maxSquats: number;
  maxPlankTime: number; // in seconds
}

// 1. ENGINE OPTIMIZATION: Formatters instantiated strictly ONCE per app lifecycle.
// Purane code me yeh har loop par new ban rahe thay. Ab inki memory reference freeze hai.
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" });
const monthYearFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dateShortFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// 2. O(1) LOOKUP DICTIONARY: Fast mapping instead of slow nested if/else statements
const EXERCISE_NAMES: Record<string, string> = {
  pushup: "Push-up",
  squat: "Squat",
  plank: "Plank",
};

export const historyService = {
  async fetchUserHistory(
    userId: string,
    filterType?: string,
    page: number = 1,
    perPage: number = 20,
    userWeightKg?: number,
    startDate?: string,
    endDate?: string
  ): Promise<HistoryItem[]> {
    const start = (page - 1) * perPage;
    const end = start + perPage - 1;

    try {
      const data = await historyRepository.getWorkouts(userId, filterType, start, end, startDate, endDate);
      if (!data || data.length === 0) return [];

      // 3. CACHE 'TODAY': Execute new Date() exactly ONCE outside the loop.
      const todayDateString = new Date().toDateString();
      
      // 4. MEMORY PRE-ALLOCATION: Pre-allocating exact array size avoids JS engine dynamic resizing lags
      const result = new Array(data.length);

      // Using standard 'for' loop - much faster than .map() for UI rendering paths
      for (let i = 0; i < data.length; i++) {
        const workout = data[i];
        const dateObj = new Date(workout.created_at);
        const isToday = todayDateString === dateObj.toDateString();

        const timeStr = timeFormatter.format(dateObj);
        const monthYear = monthYearFormatter.format(dateObj);
        const dateStr = isToday 
          ? `Today, ${timeStr}` 
          : `${dateShortFormatter.format(dateObj)}, ${timeStr}`;

        const durationSecs = workout.duration_seconds || 0;
        const mins = Math.floor(durationSecs / 60);
        const secs = durationSecs % 60;
        
        // Slightly faster string concatenation for duration
        const durationStr = (mins < 10 ? "0" + mins : mins) + ":" + (secs < 10 ? "0" + secs : secs);

        const exerciseType = workout.exercise_type;
        const exerciseName = EXERCISE_NAMES[exerciseType] || exerciseType;

        const accuracy = workout.form_accuracy || 0;
        const reps = workout.valid_rep_count || 0;
        const plankSeconds = workout.valid_active_seconds || 0;
        const paceStr = reps > 0 ? (durationSecs / reps).toFixed(1) + "s / rep" : "-";
        
        let plankEndurance = "Beginner";
        if (durationSecs >= 120) plankEndurance = "Elite";
        else if (durationSecs >= 60) plankEndurance = "Advanced";
        else if (durationSecs >= 30) plankEndurance = "Intermediate";
        
        const volume = (exerciseName === "Plank" || reps === 0) ? plankEndurance : paceStr;
        
        const weightMultiplier = (userWeightKg || 70) / 70;
        let caloriesRaw = 0;
        
        if (exerciseType === "plank" || exerciseName === "Plank") {
          caloriesRaw = (durationSecs / 60) * 4.5 * weightMultiplier;
        } else if (exerciseType === "squat" || exerciseName === "Squat") {
          caloriesRaw = reps * 0.45 * weightMultiplier;
        } else if (exerciseType === "pushup" || exerciseType === "push-up" || exerciseName === "Push-up") {
          caloriesRaw = reps * 0.55 * weightMultiplier;
        } else {
          caloriesRaw = ((durationSecs / 60) * 5) * weightMultiplier;
        }
        
        let calories = caloriesRaw < 10 && caloriesRaw > 0 
          ? Number(caloriesRaw.toFixed(1)) 
          : Math.round(caloriesRaw);
          
        // Ensure at least 1 kcal if there was some effort
        if (calories === 0 && (durationSecs > 5 || reps > 0)) calories = 1;

        result[i] = {
           id: workout.id,
           exercise: exerciseName,
           reps: exerciseName === "Plank" && reps === 0 ? 1 : reps,
           accuracy,
           date: dateStr,
           duration: durationStr,
           volume,
           calories,
          timestamp: dateObj.getTime(),
          monthYear,
          plankSeconds,
        };
      }

      return result;
    } catch (error) {
      console.error("[historyService] Error fetching history:", error);
      throw error;
    }
  },

// In historyService.ts
  async fetchPersonalRecords(userId: string): Promise<PersonalRecords> {
    try {
      // 0 JS LOOPS! Data is directly pre-calculated from Supabase engine.
      const data = await historyRepository.getPersonalRecords(userId);
      return data;
    } catch (error) {
      console.error("[historyService] Error fetching PRs:", error);
      return { maxPushups: 0, maxSquats: 0, maxPlankTime: 0 };
    }
  },

  async fetchStatisticsRangeData(userId: string, range: string): Promise<any> {
    try {
      const data = await historyRepository.getStatisticsRangeData(userId, range);
      return data;
    } catch (error) {
      console.warn("[historyService] Error fetching statistics range data (offline/transient):", error);
      return null;
    }
  }
};