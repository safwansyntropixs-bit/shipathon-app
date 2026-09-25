export interface LeaderboardUser {
  rank: number;
  name: string;
  avatar: string | null;
  score: number;
  isCurrentUser?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar: string | null;
  score: number;
  isCurrentUser?: boolean;
  isPremium?: boolean;
  level?: number;
  xp?: number;
  country_flag?: string | null;
}
