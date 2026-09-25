import { useProfileStore } from '../user/profileStore';
import { useDashboardStore, defaultDashboardData } from '../workout/dashboardStore';
import { useFriendStore } from '../social/friendStore';
import { useHistoryStore } from '../workout/historyStore';
import { useLeaderboardStore } from '../social/leaderboardStore';
import { useStreakStore } from '../gamification/streakStore';
import { useTrophyStore } from '../gamification/trophyStore';
import { useAchievementStore } from '../gamification/achievementStore';
import { useSubscriptionStore } from '../user/subscriptionStore';
import { usePreferencesStore, defaultPreferences } from './preferencesStore';

export const clearAllStores = () => {
  useProfileStore.setState({ profile: null, lastFetched: null });
  useDashboardStore.setState({ data: defaultDashboardData, lastFetched: null });
  usePreferencesStore.setState({ preferences: defaultPreferences, lastFetched: null });
  useFriendStore.setState({ friends: [], incomingRequests: [], outgoingRequests: [], searchResults: [] });
  useHistoryStore.setState({ history: [], personalRecords: null, cache: {}, rangeStats: null });
  useLeaderboardStore.setState({ entries: [] });
  useStreakStore.setState({
    currentStreak: 0,
    longestStreak: 0,
    totalSessions: 0,
    totalReps: 0,
    achievements: [],
    missedDay: false,
    lastWorkoutDate: null,
    lastFetched: null,
  });
  useTrophyStore.setState({ unlockedTrophies: [] });
  useAchievementStore.setState({ completedQuests: [], questMetrics: null, isLoaded: false });
  useSubscriptionStore.getState().reset();
};
