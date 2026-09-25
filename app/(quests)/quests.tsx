import { useFocusEffect, useRouter } from "expo-router";
import { Activity, Award, ChevronLeft, Crown, Flame, Shield, Swords, Target, Timer, Zap } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { BADGES, getRankTheme, LEVELS, QUESTS, useAchievementStore } from "../../store/gamification/achievementStore";
import { useAuthStore } from "../../store/user/authStore";
import { useDashboardStore } from "../../store/workout/dashboardStore";
import { useProfileStore } from "../../store/user/profileStore";

const ICONS = {
  Target: Target,
  Flame: Flame,
  Timer: Timer,
  Activity: Activity,
  Zap: Zap,
  Shield: Shield,
  Award: Award,
  Swords: Swords,
  Crown: Crown
};

const CountdownText = ({ type, onReset }: { type: string; onReset?: () => void }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const hasResetRef = useRef(false);

  useEffect(() => {
    hasResetRef.current = false;
    const updateTime = () => {
      const now = new Date();
      let targetDate = new Date(now);
      targetDate.setHours(23, 59, 59, 999);

      if (type === 'medium') {
        const daysUntilSunday = now.getDay() === 0 ? 0 : 7 - now.getDay();
        targetDate.setDate(targetDate.getDate() + daysUntilSunday);
      } else if (type === 'hard') {
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = lastDay - now.getDate();
        targetDate.setDate(targetDate.getDate() + daysLeft);
      }

      const diffMs = targetDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft('Resets now');
        if (!hasResetRef.current && onReset) {
          hasResetRef.current = true;
          onReset();
        }
        return;
      }

      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        setTimeLeft(`Resets in ${diffDays} day${diffDays > 1 ? 's' : ''}`);
      } else if (diffHours > 0) {
        setTimeLeft(`Resets in ${diffHours} hr${diffHours > 1 ? 's' : ''}`);
      } else if (diffMins > 0) {
        setTimeLeft(`Resets in ${diffMins} min${diffMins > 1 ? 's' : ''}`);
      } else {
        setTimeLeft(`Resets in ${diffSecs} s`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [type, onReset]);

  return <Text className="text-[10px] font-outfitMed text-white/40">{timeLeft}</Text>;
};

const AnimatedProgressBar = ({ progress, target, color }: { progress: number, target: number, color: string }) => {
  const widthVal = useSharedValue(0);
  const percent = Math.min((progress / target) * 100, 100);

  useEffect(() => {
    widthVal.value = withDelay(300, withTiming(percent, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [percent]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value}%`
  }));

  return (
    <View className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
      <Animated.View className="h-full rounded-full" style={[animatedStyle, { backgroundColor: color }]} />
    </View>
  );
};

export default function QuestsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const { profile, fetchProfile } = useProfileStore();
  const { loadDashboardData } = useDashboardStore();
  const { calculateProgress, loadCompletedQuests, completedQuests, claimQuest, isLoaded } = useAchievementStore();

  const [activeTab, setActiveTab] = useState<'daily' | 'medium' | 'hard'>('daily');

  const refreshAllData = useCallback(() => {
    if (user?.id) {
      fetchProfile();
      loadDashboardData(user.id, true);
      loadCompletedQuests(user.id);
    }
  }, [user?.id, fetchProfile, loadDashboardData, loadCompletedQuests]);

  // Always refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      refreshAllData();
    }, [refreshAllData])
  );

  // Auto-refresh on AppState foreground and period rollover
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshAllData();
      }
    });

    let lastDateStr = new Date().toDateString();
    const interval = setInterval(() => {
      const currentDateStr = new Date().toDateString();
      if (currentDateStr !== lastDateStr) {
        lastDateStr = currentDateStr;
        refreshAllData();
      }
    }, 15000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [refreshAllData]);

  const xp = profile?.xp || 0;
  const levelRank = profile?.level || 1;
  const rankInfo = LEVELS.find(l => l.rank === levelRank) || LEVELS[0];
  const nextRankInfo = LEVELS.find(l => l.rank === levelRank + 1) || LEVELS[LEVELS.length - 1];
  const theme = getRankTheme(levelRank);

  const activeQuests = useMemo(() => {
    return QUESTS.filter(q => q.type === activeTab);
  }, [activeTab]);

  // Check and claim any completed quests automatically when loaded
  useEffect(() => {
    if (user?.id && isLoaded && profile) {
      activeQuests.forEach(q => {
        const p = calculateProgress(q);
        if (p >= q.target && !completedQuests.includes(q.id)) {
          claimQuest(user.id, q.id);
        }
      });
    }
  }, [user?.id, isLoaded, profile, activeQuests, calculateProgress, completedQuests, claimQuest]);

  const tabs = [
    { id: 'daily', label: 'Daily', xpText: '+50 XP', color: '#3A9E66' },
    { id: 'medium', label: 'Weekly', xpText: '+150 XP', color: '#F0B35C' },
    { id: 'hard', label: 'Monthly', xpText: '+300 XP', color: '#E55C5C' },
  ];

  const currentTabColor = tabs.find(t => t.id === activeTab)?.color || '#3A9E66';

  return (
    <View className="flex-1">
      <PremiumAmbientBackground color={currentTabColor} opacity={0.15} />

      {/* Header */}
      <View className="pt-8 pb-1 px-5 flex-row items-center z-20">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-white/5">
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-5 pt-1 pb-4">

        {/* Level Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} className="rounded-3xl border p-3 mb-4 relative overflow-hidden" style={{ borderColor: `${theme.color}40`, backgroundColor: '#121212' }}>
          <View className="flex-row items-center gap-4">

            <View className="w-20 h-20 items-center justify-center relative">
              {/* Glow Effect */}
              <View
                className="absolute w-12 h-12 rounded-full"
                style={{
                  backgroundColor: theme.color,
                  shadowColor: theme.color,
                  shadowOpacity: 0.8,
                  shadowRadius: 25,
                  elevation: 10
                }}
              />
              <Image source={BADGES[rankInfo.name]} style={{ width: 72, height: 72, resizeMode: 'contain', zIndex: 10 }} />
            </View>

            <View className="flex-1">
              <Text className="text-[10px] font-outfitBold tracking-widest uppercase mb-1" style={{ color: theme.color }}>
                {theme.name} • RANK {levelRank}
              </Text>
              <Text className="text-3xl font-outfitBlack text-white uppercase tracking-tight mb-2">{rankInfo.name}</Text>

              <View className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                <View className="h-full rounded-full" style={{ width: `${Math.min((xp / nextRankInfo.minXp) * 100, 100)}%`, backgroundColor: theme.color }} />
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-outfitMed text-[#A1A1AA]">{xp.toLocaleString()} XP</Text>
                <Text className="text-[10px] font-outfitMed text-[#A1A1AA]">{nextRankInfo.minXp.toLocaleString()} to {nextRankInfo.name}</Text>
              </View>
            </View>

          </View>
        </Animated.View>

        {/* Segmented Controls */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} className="flex-row gap-2 mb-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                className={`flex-1 items-center justify-center rounded-2xl py-2 border`}
                style={{
                  backgroundColor: isActive ? `${tab.color}10` : '#121212',
                  borderColor: isActive ? `${tab.color}50` : 'rgba(255,255,255,0.05)'
                }}
              >
                <Text className={`text-xs font-outfitBold mb-1 ${isActive ? 'text-white' : 'text-white/60'}`}>{tab.label}</Text>
                <Text className="text-[9px] font-outfitBold uppercase tracking-wider" style={{ color: isActive ? tab.color : '#71717A' }}>
                  {tab.xpText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Quests List */}
        <View className="flex-col gap-3">
          {activeQuests.map((q, idx) => {
            const isCompleted = completedQuests.includes(q.id);
            const p = calculateProgress(q);
            const isDone = isCompleted || p >= q.target;
            const IconComp = ICONS[q.icon as keyof typeof ICONS] || Zap;

            return (
              <Animated.View
                entering={FadeInDown.delay(300 + (idx * 50)).duration(400)}
                key={q.id}
                className="rounded-2xl p-3 border"
                style={{
                  backgroundColor: isDone ? `${currentTabColor}15` : 'rgba(18, 18, 18, 0.5)',
                  borderColor: isDone ? `${currentTabColor}50` : `${currentTabColor}25`
                }}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-row items-center flex-1 pr-4">
                    <View className="w-10 h-10 rounded-full border items-center justify-center mr-3" style={{ borderColor: `${currentTabColor}30`, backgroundColor: `${currentTabColor}05` }}>
                      <IconComp size={18} color={currentTabColor} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-outfitBlack text-white mb-0.5">{q.title}</Text>
                      <Text className="text-xs font-outfitMed text-[#A1A1AA]">{q.description}</Text>
                    </View>
                  </View>

                  <View className="px-2.5 py-1 rounded-full border" style={{ backgroundColor: `${currentTabColor}10`, borderColor: `${currentTabColor}30` }}>
                    <Text className="text-[10px] font-outfitBold uppercase tracking-wider" style={{ color: currentTabColor }}>
                      +{q.xpReward} XP
                    </Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-end mt-2">
                  <CountdownText type={q.type} onReset={refreshAllData} />
                  <Text className="text-xs font-outfitBlack" style={{ color: currentTabColor }}>
                    {isDone ? `${q.xpReward} XP GAINED` : `${Math.floor(p)} / ${q.target}`}
                  </Text>
                </View>

                <AnimatedProgressBar progress={isDone ? q.target : p} target={q.target} color={currentTabColor} />
              </Animated.View>
            );
          })}
        </View>

        {/* Path / Badges Section */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)} className="mt-8 mb-2">
          <Text className="text-[10px] font-outfitBold tracking-widest text-white/50 uppercase mb-2">Your Path</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {LEVELS.filter(l => l.rank <= 10).map((l) => {
              const isActive = l.rank === levelRank;
              const isPassed = l.rank < levelRank;
              const lTheme = getRankTheme(l.rank);

              return (
                <View key={l.rank} className="items-center opacity-100" style={{ opacity: isActive ? 1 : isPassed ? 0.7 : 0.3 }}>
                  <View className="w-16 h-16 items-center justify-center relative mb-1">
                    <Image source={BADGES[l.name]} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
                  </View>
                  <Text className={`text-[9px] font-outfitBold uppercase tracking-wider ${isActive ? 'text-white' : 'text-[#71717A]'}`}>
                    {l.name}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>

      </View>
    </View>
  );
}
