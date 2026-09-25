import { friendRepository } from "@/repositories/social/friendRepository";
import { historyRepository } from "@/repositories/workout/historyRepository";
import { calculateActiveStreak, streakService } from "@/services/gamification/streakService";

export interface FriendProfile {
  id: string;
  username: string;
  avatar_url: string;
  total_volume: number;
  level?: number;
  xp?: number;
  created_at?: string;
  points?: number; // fallback property
  is_premium?: boolean;
  country_flag?: string | null;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status?: string;
  created_at?: string;
  profile?: FriendProfile;
}

export interface FriendWorkoutItem {
  id: string;
  exercise_type: string;
  rep_count: number;
  duration_seconds: number;
  created_at: string;
}

export interface FriendAchievementItem {
  achievement_id: string;
  type: string;
  progress: number;
  is_completed: boolean;
  created_at: string;
}

import { UserTrophiesData } from "@/types/user.types";

export interface FriendFullDetails {
  profile: FriendProfile;
  workouts: FriendWorkoutItem[];
  achievements: FriendAchievementItem[];
  stats: {
    totalVolume: number;
    totalXP: number;
    level: number;
    workoutCount: number;
    completedAchievementsCount: number;
    pushupsCount: number;
    squatsCount: number;
    plankSeconds: number;
    globalRank: number | null;
    streak: number;
    maxPushups: { reps: number; duration: number };
    maxSquats: { reps: number; duration: number };
    maxPlank: { duration: number };
  };
  trophyCounts: UserTrophiesData;
}

export const friendService = {
  async searchUsers(query: string, currentUserId: string): Promise<FriendProfile[]> {
    if (!query || query.length < 2) return [];
    return await friendRepository.searchUsers(query, currentUserId);
  },

  async getFriends(userId: string): Promise<FriendProfile[]> {
    const friends = await friendRepository.getFriends(userId);
    const friendIds = friends.map((f: any) => f.friend_id);
    return await friendRepository.getProfilesByIds(friendIds);
  },

  async getFriendFullDetails(friendId: string, isPro: boolean = false): Promise<FriendFullDetails | null> {
    const fetchPersonalRecordsPromise = isPro
      ? historyRepository.getPersonalRecords(friendId)
      : Promise.resolve({ maxPushups: 0, maxSquats: 0, maxPlankTime: 0 });

    const fetchStreakPromise = isPro
      ? streakService.fetchStreakData(friendId).catch(() => null)
      : Promise.resolve(null);

    const [profile, personalRecords, streakData, achievements, rank, trophyCounts] = await Promise.all([
      friendRepository.getFriendSingleProfile(friendId),
      fetchPersonalRecordsPromise,
      fetchStreakPromise,
      friendRepository.getFriendAchievements(friendId),
      friendRepository.getFriendRank(friendId),
      friendRepository.getFriendTrophies(friendId)
    ]);

    if (!profile) return null;

    const maxPushups = { reps: personalRecords?.maxPushups || 0, duration: 0 };
    const maxSquats = { reps: personalRecords?.maxSquats || 0, duration: 0 };
    const maxPlank = { duration: personalRecords?.maxPlankTime || 0 };
    const activeStreak = calculateActiveStreak(
      profile.streak_count || 0,
      profile.last_workout_date,
      profile.timezone
    );
    const streak = streakData?.currentStreak ?? activeStreak;

    return {
      profile: {
        id: profile.id,
        username: profile.username || "Anonymous User",
        avatar_url: profile.avatar_url,
        total_volume: profile.total_volume || 0,
        level: profile.level || 1,
        xp: profile.xp || 0,
        created_at: profile.created_at,
        country_flag: profile.country_flag
      },
      workouts: [],
      achievements,
      stats: {
        totalVolume: profile.total_volume || 0,
        totalXP: profile.xp || 0,
        level: profile.level || 1,
        workoutCount: profile.total_workouts || 0,
        completedAchievementsCount: achievements.length,
        pushupsCount: 0,
        squatsCount: 0,
        plankSeconds: 0,
        globalRank: rank,
        streak,
        maxPushups,
        maxSquats,
        maxPlank
      },
      trophyCounts
    };
  },

  async getPendingRequests(userId: string): Promise<{ incoming: FriendRequest[], outgoing: FriendRequest[] }> {
    const [incoming, outgoing] = await Promise.all([
      friendRepository.getIncomingRequests(userId),
      friendRepository.getOutgoingRequests(userId)
    ]);

    const senderIds = incoming.map(r => r.sender_id);
    const senderProfiles = await friendRepository.getProfilesByIds(senderIds);
    const incomingWithProfiles = incoming.map(r => ({
      ...r,
      profile: senderProfiles.find(p => p.id === r.sender_id)
    }));

    const receiverIds = outgoing.map(r => r.receiver_id);
    const receiverProfiles = await friendRepository.getProfilesByIds(receiverIds);
    const outgoingWithProfiles = outgoing.map(r => ({
      ...r,
      profile: receiverProfiles.find(p => p.id === r.receiver_id)
    }));

    return {
      incoming: incomingWithProfiles,
      outgoing: outgoingWithProfiles
    };
  },

  async sendFriendRequest(senderId: string, receiverId: string) {
    return await friendRepository.sendFriendRequest(senderId, receiverId);
  },

  async acceptRequest(requestId: string, senderId: string, receiverId: string) {
    return await friendRepository.acceptRequest(requestId, senderId, receiverId);
  },

  async rejectRequest(requestId: string) {
    return await friendRepository.rejectRequest(requestId);
  },

  async removeFriend(userId: string, friendId: string) {
    return await friendRepository.removeFriend(userId, friendId);
  }
};
