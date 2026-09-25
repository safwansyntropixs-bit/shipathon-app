export interface Profile {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  is_premium: boolean;
  streak_count: number;
  longest_streak: number;
  total_workouts: number;
  last_workout_date?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  gender?: string | null;
  country?: string | null;
  country_flag?: string | null;
  level: number;
  xp: number;
  created_at: string;
  preferences?: CloudPreferences;
}

export interface CloudPreferences {
  voiceCoach: boolean;
}

export interface UserPreferences {
  highRes: boolean;
  haptics: boolean;
  voiceCoach: boolean;
  privacyLock: boolean;
  theme: "dark" | "light";
  prepTimer: number;
}

export interface TrophyBreakdown {
  rank1: number;
  rank2: number;
  rank3: number;
}

export interface UserTrophiesData {
  rank1: number;
  rank2: number;
  rank3: number;
  weekly: TrophyBreakdown;
  monthly: TrophyBreakdown;
}
