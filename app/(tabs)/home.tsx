import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";

import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import {
  AppState,
  InteractionManager,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Circle, Defs, Line, RadialGradient, Stop, Svg } from "react-native-svg";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { SkeletonBlock } from "../../components/loaders/SkeletonLoader";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { BADGES, getRankTheme, LEVELS, QUESTS, useAchievementStore } from "../../store/gamification/achievementStore";
import { useStreakStore } from "../../store/gamification/streakStore";
import { useAuthStore } from "../../store/user/authStore";
import { useProfileStore } from "../../store/user/profileStore";
import { useDashboardStore } from "../../store/workout/dashboardStore";
const PUSHUP_ICON = require("../../assets/home_icons/pushup_icon.png");
const SQUAT_ICON = require("../../assets/home_icons/squat_icon.png");
const PLANK_ICON = require("../../assets/home_icons/plank_icon.png");

// COMPONENT SE BAHAR MOVED: Memory allocation bachaney ke liye (ab hook based ho gaya hai for dynamic updates)
const useCurrentDates = () => {
  const [todayStr, setTodayStr] = useState(new Date().toDateString());

  useEffect(() => {
    // Re-evaluate when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setTodayStr(new Date().toDateString());
      }
    });

    // Re-evaluate every minute just in case user is staring at the screen at midnight
    const interval = setInterval(() => {
      setTodayStr(new Date().toDateString());
    }, 60000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  return useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.getDate().toString(),
        fullDate: d,
        active: false,
      });
    }
    return dates;
  }, [todayStr]);
};

const QUOTES = [
  "Stay disciplined.",
  "Lock your form.",
  "Own the day.",
  "Keep pushing.",
  "Stay consistent.",
  "Defy gravity.",
  "Embrace the grind."
];

const GlassSurface = ({ children }: { children: React.ReactNode }) => {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={20} tint="dark" className="flex-1 p-3 justify-between">
        {children}
      </BlurView>
    );
  }
  return (
    <View className="flex-1 p-3 justify-between bg-[#1A1A1A]/95">
      {children}
    </View>
  );
};

// 🌟 FIXED 7-DAY ROLLING STREAK CARD (Scalable & Locked Height) 🌟
const PremiumStreakCard = ({ currentStreak }: { currentStreak: number }) => {
  const days = Array.from({ length: 7 }).map((_, i) => ({
    id: i,
    // Just a simple visual for the rolling window based on current streak
    active: i < Math.min(currentStreak, 7)
  }));

  const nextMilestone = Math.floor(currentStreak / 7 + 1) * 7;
  const daysLeft = nextMilestone - currentStreak;

  let xpBonus = 250;
  if (nextMilestone === 7) xpBonus = 100;
  else if (nextMilestone === 14) xpBonus = 150;
  else if (nextMilestone === 21) xpBonus = 200;

  return (
    <Animated.View entering={FadeInDown.delay(250).duration(400)} className="rounded-2xl border border-[#3A9E66]/20 bg-[#121212]/50 p-3 mb-2.5">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-[9px] font-outfitBold uppercase tracking-widest text-[#A1A1AA]">7-Day Consistency</Text>
        <Text className="text-[9px] font-outfitBold uppercase tracking-widest text-[#F0B35C]">
          {xpBonus}XP AWAITS IN {daysLeft} {daysLeft === 1 ? 'DAY' : 'DAYS'}
        </Text>
      </View>

      <View className="flex-row justify-between items-end">
        <View className="flex-row items-baseline gap-1">
          <Text className="text-2xl font-outfitBlack text-white tracking-tighter" style={{ lineHeight: 28 }}>
            {currentStreak}
          </Text>
          <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest ml-1">
            Days
          </Text>
        </View>

        <View className="flex-row gap-1.5 pb-1">
          {days.map((day) => (
            <View
              key={day.id}
              className={`w-3.5 h-3.5 rounded-full ${day.active ? 'bg-[#3A9E66]' : 'bg-[#1A1A1A] border border-white/5'}`}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

// 🌟 DAILY TIME DURATION CARD 🌟
const PremiumDurationCard = ({ duration, unit }: { duration: number, unit: string }) => {
  return (
    <Animated.View entering={FadeInDown.delay(250).duration(400)} className="rounded-2xl border border-[#3A9E66]/20 overflow-hidden h-24 bg-[#121212]/50 relative">
      <GlassSurface>
        <View className="flex-row justify-between items-start z-10">
          <Text className="text-[9px] font-outfitBold uppercase tracking-widest text-[#A1A1AA]">Duration</Text>
        </View>

        <View className="flex-1 justify-center items-start z-10 my-0.5">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-3xl font-outfitBlack text-white tracking-tighter" style={{ lineHeight: 34 }}>
              {duration}
            </Text>
            <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest ml-1">
              {unit}
            </Text>
          </View>
        </View>
      </GlassSurface>
    </Animated.View>
  );
};

const EmberParticle = ({ index, estimatedCalories }: { index: number; estimatedCalories: number }) => {
  const speedFactor = Math.max(0.2, 1 - (estimatedCalories / 800)); // Faster as kcal increases
  const seed = (index * 137) % 100;
  const risingDistance = 40 + (seed % 40);
  const duration = (2500 + (seed * 60)) * speedFactor;
  const initialDelay = seed * 60 * speedFactor;
  const size = 2.5 + (seed % 2.5);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const finalOpacity = 0.7 + (seed % 3) * 0.1;

    translateY.value = withDelay(
      initialDelay,
      withRepeat(
        withTiming(-risingDistance, { duration, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );

    opacity.value = withDelay(
      initialDelay,
      withRepeat(
        withSequence(
          withTiming(finalOpacity, { duration: duration * 0.1 }),
          withTiming(finalOpacity, { duration: duration * 0.4 }),
          withTiming(0, { duration: duration * 0.5 })
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(translateY);
      cancelAnimation(opacity);
    };
  }, [initialDelay, duration, risingDistance, seed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="rounded-full bg-[#FF5722]"
      style={[
        animatedStyle,
        {
          width: size,
          height: size,
          position: 'absolute',
          bottom: -size,
          left: `${(seed % 94) + 3}%`,
          shadowColor: '#FF5722',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 4,
          elevation: 2
        }
      ]}
    />
  );
};

const PremiumCaloriesCard = ({ estimatedCalories }: { estimatedCalories: number }) => {
  const pulse = useSharedValue(0.1);
  const speedFactor = Math.max(0.2, 1 - (estimatedCalories / 800));
  const pulseDuration = 2500 * speedFactor;

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.3, { duration: pulseDuration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(pulse);
  }, [pulseDuration]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      entering={FadeInDown.delay(350).duration(400)}
      className="rounded-2xl border border-[#F0B35C]/20 overflow-hidden h-24 bg-[#121212]/50 relative"
    >
      <Animated.View style={[bgStyle, { position: 'absolute', bottom: -30, right: -30, width: 100, height: 100 }]} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="heatGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#FF5722" stopOpacity="1" />
              <Stop offset="100%" stopColor="#121212" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#heatGlow)" />
        </Svg>
      </Animated.View>

      <GlassSurface>
        <View className="flex-row justify-between items-start z-10">
          <Text className="text-[9px] font-outfitBold uppercase tracking-widest text-[#A1A1AA]">
            Energy Burn
          </Text>
        </View>

        <View className="flex-1 justify-center items-start z-10">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-2xl font-outfitBlack text-white tracking-tighter">
              {estimatedCalories}
            </Text>
            <Text className="text-[9px] font-outfitBold text-[#F0B35C] uppercase tracking-widest">
              kcal
            </Text>
          </View>
        </View>

        <View className="absolute bottom-0 left-0 right-0 h-10 z-10 pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <EmberParticle key={i} index={i} estimatedCalories={estimatedCalories} />
          ))}
        </View>
      </GlassSurface>
    </Animated.View>
  );
};

const AnimatedStopwatchIcon = ({ size = 14, color = "#3A9E66" }) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { duration: 70000, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(rotation);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 2 * Math.PI}rad` }]
  }));

  const needleRadius = size * (4.5 / 24);
  const needleWidth = 1.5;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute' }}>
        <Line x1="10" y1="2" x2="14" y2="2" />
        <Line x1="12" y1="2" x2="12" y2="6" />
        <Circle cx="12" cy="14" r="8" />
      </Svg>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: (size / 2) - needleRadius,
            top: ((size * 14) / 24) - needleRadius,
            width: needleRadius * 2,
            height: needleRadius * 2,
          },
          animatedStyle
        ]}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: needleRadius - (needleWidth / 2),
            width: needleWidth,
            height: needleRadius,
            backgroundColor: color,
            borderRadius: 1
          }}
        />
      </Animated.View>
    </View>
  );
};

const PremiumWorkoutsCard = ({ count }: { count: number }) => {
  const formattedCount = count.toString().padStart(2, '0');

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(400)} className="rounded-2xl border border-[#3A9E66]/30 overflow-hidden h-20 bg-[#121212]/50 relative">
      <GlassSurface>
        <View className="flex-row justify-between items-start z-10">
          <Text className="text-[9px] font-outfitBold uppercase tracking-widest text-[#A1A1AA]">Workouts</Text>
        </View>

        <View className="flex-1 justify-center items-start z-10">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-3xl font-outfitBlack text-white tracking-tight">
              {formattedCount}
            </Text>
            <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest ml-1">
              Sessions
            </Text>
          </View>
        </View>
      </GlassSurface>
    </Animated.View>
  );
};

// 🌟 LEVEL & PROGRESS COMPONENT 🌟
const PremiumLevelCard = ({ level, xp, nextLevelXp, rankName }: { level: number, xp: number, nextLevelXp: number, rankName: string }) => {
  const progress = Math.min((xp / (nextLevelXp || 1)) * 100, 100);
  const theme = getRankTheme(level);

  return (
    <Animated.View entering={FadeInDown.delay(350).duration(400)} className="mb-2.5 bg-[#121212]/50 border p-3 rounded-2xl relative overflow-hidden" style={{ borderColor: `${theme.color}30` }}>
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-row items-center gap-2">
          {/* Miniature Badge Icon */}
          <View className="w-8 h-8 rounded-full items-center justify-center relative border" style={{ borderColor: `${theme.color}30`, backgroundColor: `${theme.color}10` }}>
            <View className="absolute w-4 h-4 rounded-full" style={{ backgroundColor: theme.color, shadowColor: theme.color, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 }} />
            <Image source={BADGES[rankName]} style={{ width: 28, height: 28, zIndex: 10 }} contentFit="contain" />
          </View>
          <View>
            <Text className="text-[8px] font-outfitBold uppercase tracking-widest" style={{ color: theme.color }}>Rank {level}</Text>
            <Text className="text-sm font-outfitBlack tracking-tight text-white">{rankName}</Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-xs font-outfitBlack text-white">{xp.toLocaleString()} <Text className="text-[9px] font-outfitMed text-[#A1A1AA]">XP</Text></Text>
          <Text className="text-[8px] font-outfitMed text-[#A1A1AA] uppercase tracking-widest">{nextLevelXp.toLocaleString()} XP next</Text>
        </View>
      </View>
      <View className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: theme.color }} />
      </View>
    </Animated.View>
  );
};

// 🌟 ANIMATED PROGRESS BAR 🌟
const AnimatedHomeProgressBar = ({ percent, color }: { percent: number, color: string }) => {
  const widthVal = useSharedValue(0);

  useEffect(() => {
    widthVal.value = withDelay(300, withTiming(percent, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [percent]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value}%`
  }));

  return (
    <View className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
      <Animated.View className="h-full rounded-full" style={[animatedStyle, { backgroundColor: color }]} />
    </View>
  );
};

// 🌟 ACTIVE QUESTS (COMPACT GRID) 🌟
const ActiveQuestsList = ({ quests, calculateProgress, completedQuests, questMetrics: _questMetrics }: { quests: any[], calculateProgress: (q: any) => number, completedQuests?: string[], questMetrics: any }) => {
  const router = useRouter();

  return (
    <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mb-2.5">
      <View className="flex-row items-center justify-between mb-1.5 px-0.5">
        <Text className="text-xs font-outfitBold text-white tracking-wide">Active Quests</Text>
        <TouchableOpacity
          onPress={() => router.navigate('/quests')}
          activeOpacity={0.7}
          className="bg-[#3A9E66]/10 px-2 py-1 rounded-full border border-[#3A9E66]/20"
        >
          <Text className="text-[9px] font-outfitBold text-[#3A9E66] uppercase tracking-widest">Show All</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row gap-2">
        {quests.slice(0, 3).map((q) => {
          const isCompleted = completedQuests?.includes(q.id);
          const p = calculateProgress(q);
          const percent = Math.min((p / q.target) * 100, 100);
          const isDone = isCompleted || p >= q.target;

          const qColor = q.type === 'daily' ? '#3A9E66' : q.type === 'medium' ? '#F0B35C' : '#E55C5C';

          return (
            <View
              key={q.id}
              className="flex-1 p-2 rounded-xl border"
              style={{
                backgroundColor: isDone ? `${qColor}15` : 'rgba(18, 18, 18, 0.5)',
                borderColor: isDone ? `${qColor}50` : `${qColor}25`
              }}
            >
              <View className="flex-row justify-end items-center mb-1">
                <Text className="text-[8px] font-outfitBold" style={{ color: qColor }}>+{q.xpReward} XP</Text>
              </View>
              <Text className={`text-[9px] font-outfitBold ${isDone ? 'text-white' : 'text-white/80'} mb-1.5`} numberOfLines={1}>{q.title}</Text>
              <View className="mt-auto">
                <View className="flex-row justify-between items-center mb-0.5">
                  {isDone ? (
                    <Text className="text-[7px] font-outfitBold text-white/40 uppercase tracking-widest">{q.xpReward} XP Gained</Text>
                  ) : (
                    <>
                      <Text className="text-[7px] font-outfitBold text-white/40">{Math.floor(p)}/{q.target}</Text>
                      <Text className="text-[7px] font-outfitBlack" style={{ color: qColor }}>{Math.floor(percent)}%</Text>
                    </>
                  )}
                </View>
                <AnimatedHomeProgressBar percent={percent} color={qColor} />
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
};

export default function Home() {
  const DATES = useCurrentDates();
  const router = useRouter();

  const userId = useAuthStore((state) => state.user?.id);
  const userEmail = useAuthStore((state) => state.user?.email);

  const currentStreak = useStreakStore((state) => state.currentStreak);
  const loadStreakData = useStreakStore((state) => state.loadStreakData);
  const dashboardData = useDashboardStore((state) => state.data);
  const isDashboardLoading = useDashboardStore((state) => state.isLoading);
  const loadDashboardData = useDashboardStore((state) => state.loadDashboardData);

  const fetchProfile = useProfileStore((state) => state.fetchProfile);
  const profile = useProfileStore((state) => state.profile);

  const { completedQuests, calculateProgress, claimQuest, loadCompletedQuests, questMetrics } = useAchievementStore();

  const loadDailyData = useDashboardStore((state) => state.loadDailyData);

  const [isScreenReady, setIsScreenReady] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState(6); // Default to today (last index)

  const isSelectedToday = selectedDateIndex === 6;

  useEffect(() => {
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      setIsScreenReady(true);
    });
    return () => interactionTask.cancel();
  }, []);

  useEffect(() => {
    if (isScreenReady && userId) {
      Promise.all([
        loadStreakData(userId),
        loadDashboardData(userId),
        fetchProfile(),
        loadCompletedQuests(userId)
      ]);
    }
  }, [userId, isScreenReady]);

  const xp = profile?.xp || 0;
  const levelRank = profile?.level || 1;
  const rankInfo = LEVELS.find(l => l.rank === levelRank) || LEVELS[0];
  const nextRankInfo = LEVELS.find(l => l.rank === levelRank + 1) || LEVELS[LEVELS.length - 1];

  const activeQuests = useMemo(() => {
    return QUESTS.filter(q => q.type === 'daily' || q.type === 'medium' || (q.type as string) === 'weekly');
  }, []);

  const isQuestsLoaded = useAchievementStore((state) => state.isLoaded);

  useEffect(() => {
    if (userId && dashboardData && isQuestsLoaded && profile && isSelectedToday) {
      activeQuests.forEach(q => {
        const p = calculateProgress(q);
        if (p >= q.target && !completedQuests.includes(q.id)) {
          claimQuest(userId, q.id);
        }
      });
    }
  }, [dashboardData, completedQuests, userId, isQuestsLoaded, profile, activeQuests, calculateProgress, claimQuest, isSelectedToday]);

  const { name, initials } = useMemo(() => {
    const rawName = profile?.username || dashboardData?.username || userEmail?.split('@')[0] || "User";
    const parts = rawName.trim().split(" ");
    let init = "US";
    if (parts.length >= 2) {
      init = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
      init = parts[0][0].toUpperCase();
    }
    return { name: parts.join(" "), initials: init };
  }, [profile?.username, dashboardData?.username, userEmail]);

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = "Ready?";
    if (hour < 12) timeGreeting = "Good morning.";
    else if (hour < 18) timeGreeting = "Good afternoon.";
    else timeGreeting = "Good evening.";

    const quoteIndex = new Date().getDay() % QUOTES.length;
    return `${timeGreeting} ${QUOTES[quoteIndex]}`;
  }, []);

  const { estimatedCalories, totalWorkouts, streakPercentage, todayDuration, todayDurationUnit, todayPlankVal, todayPlankUnit } = useMemo(() => {
    let calories = 0;
    const todayPushups = dashboardData?.todayPushupReps || 0;
    const todaySquats = dashboardData?.todaySquatReps || 0;
    const todayPlanksMin = dashboardData?.todayPlankTimeMin || 0;

    if (profile?.weight_kg) {
      const pushupMins = todayPushups * 3 / 60;
      const squatMins = todaySquats * 4 / 60;

      const pushupCal = 8 * profile.weight_kg * (pushupMins / 60);
      const squatCal = 8 * profile.weight_kg * (squatMins / 60);
      const plankCal = 4 * profile.weight_kg * (todayPlanksMin / 60);

      calories = Math.floor(pushupCal + squatCal + plankCal);
    } else {
      // Base average if no weight is provided (approximate for a ~70kg person)
      const pushupCal = todayPushups * 0.46;
      const squatCal = todaySquats * 0.62;
      const plankCal = todayPlanksMin * 4.66;
      calories = Math.floor(pushupCal + squatCal + plankCal);
    }

    const workouts = dashboardData?.todayWorkouts || 0;
    const streakPct = Math.min(((currentStreak || 0) / 7) * 100, 100);

    const todayPushupSecs = (dashboardData?.todayPushupReps || 0) * 3;
    const todaySquatSecs = (dashboardData?.todaySquatReps || 0) * 4;
    const todayPlankSecs = (dashboardData?.todayPlankTimeMin || 0) * 60;
    const totalDurationSecs = Math.floor(todayPushupSecs + todaySquatSecs + todayPlankSecs);

    const duration = totalDurationSecs < 60 ? totalDurationSecs : Math.floor(totalDurationSecs / 60);
    const unit = totalDurationSecs < 60 ? 'Secs' : 'Mins';

    const plankTotalSecs = Math.floor(todayPlankSecs);
    const plankVal = plankTotalSecs < 60 ? plankTotalSecs : Math.floor(plankTotalSecs / 60);
    const plankUnit = plankTotalSecs < 60 ? 'sec' : 'min';

    return {
      estimatedCalories: calories,
      totalWorkouts: workouts,
      streakPercentage: streakPct,
      todayDuration: duration,
      todayDurationUnit: unit,
      todayPlankVal: plankVal,
      todayPlankUnit: plankUnit
    };
  }, [dashboardData, currentStreak, profile?.weight_kg]);

  const horizontalScrollStyle = useMemo(() => ({ gap: 8 }), []);

  const handleDatePress = (idx: number) => {
    setSelectedDateIndex(idx);
    if (userId) {
      loadDailyData(userId, DATES[idx].fullDate);
    }
  };


  if (isDashboardLoading || !isScreenReady) {
    return (
      <View className="flex-1 bg-transparent">
        <PremiumAmbientBackground />
        <View className="flex-1 px-5 pt-3 pb-24 justify-between z-20">
          {/* Header Skeleton */}
          <View className="flex-row justify-between items-center mt-1 mb-2">
            <View className="flex-1 mr-3">
              <SkeletonBlock width="60%" height={24} borderRadius={4} className="mb-2" />
              <SkeletonBlock width="40%" height={12} borderRadius={4} />
            </View>
            <SkeletonBlock width={36} height={36} borderRadius={18} />
          </View>

          {/* Date Selector Row Skeleton */}
          <View className="mb-2.5 flex-row justify-between w-full">
            {Array.from({ length: 7 }).map((_, idx) => (
              <SkeletonBlock key={idx} width="13%" height={48} borderRadius={12} />
            ))}
          </View>

          {/* Level Progress Skeleton */}
          <View className="mb-2.5 bg-[#121212]/50 border border-[#3A9E66]/30 p-3 rounded-2xl">
            <View className="flex-row items-center justify-between mb-1.5">
              <View className="flex-row items-center gap-2">
                <SkeletonBlock width={28} height={28} borderRadius={14} />
                <View>
                  <SkeletonBlock width={40} height={10} borderRadius={4} className="mb-1" />
                  <SkeletonBlock width={60} height={14} borderRadius={4} />
                </View>
              </View>
              <View className="items-end">
                <SkeletonBlock width={50} height={14} borderRadius={4} className="mb-1" />
                <SkeletonBlock width={40} height={10} borderRadius={4} />
              </View>
            </View>
            <SkeletonBlock width="100%" height={6} borderRadius={3} />
          </View>

          {/* 7-Day Consistency Skeleton */}
          <View className="rounded-2xl border border-[#3A9E66]/20 bg-[#121212]/50 p-3 mb-2.5">
            <View className="flex-row justify-between items-center mb-1">
              <SkeletonBlock width={100} height={12} borderRadius={4} />
              <SkeletonBlock width={12} height={12} borderRadius={6} />
            </View>
            <View className="flex-row justify-between items-end">
              <SkeletonBlock width={60} height={28} borderRadius={4} />
              <View className="flex-row gap-1.5 pb-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <SkeletonBlock key={i} width={14} height={14} borderRadius={7} />
                ))}
              </View>
            </View>
          </View>

          {/* Grid Layout Skeleton */}
          <View className="flex-row gap-2.5 mb-2.5">
            <View className="flex-1 flex-col gap-2.5">
              <SkeletonBlock height={112} borderRadius={16} />
              <SkeletonBlock height={112} borderRadius={16} />
              <SkeletonBlock height={80} borderRadius={16} />
            </View>
            <View className="flex-1 flex-col gap-2.5">
              <SkeletonBlock height={96} borderRadius={16} />
              <SkeletonBlock height={112} borderRadius={16} />
              <SkeletonBlock height={96} borderRadius={16} />
            </View>
          </View>

          {/* Active Quests Skeleton */}
          <View className="mb-2.5">
            <View className="flex-row items-center justify-between mb-2 px-0.5">
              <SkeletonBlock width={80} height={14} borderRadius={4} />
              <SkeletonBlock width={50} height={18} borderRadius={9} />
            </View>
            <View className="flex-row gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <View key={i} className="flex-1">
                  <SkeletonBlock width="100%" height={56} borderRadius={12} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      {/* Signature Ambient Green Glow */}
      <PremiumAmbientBackground />

      {/* Main Single Screen Layout Container (No Scrolling Needed!) */}
      <View className="flex-1 px-5 pt-3 pb-24 justify-between z-20">

        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          className="flex-row justify-between items-center mt-1 mb-2"
          style={{ zIndex: 100, elevation: 10 }}
        >
          <View className="flex-1 mr-3">
            <Text
              className="text-xl font-outfitBlack tracking-tight text-white leading-tight"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              HELLO, {name.toUpperCase()}
            </Text>
            <View className="flex-row items-center mt-0.5 space-x-1 gap-1">
              <Text className="flex-1 text-[10px] text-[#A1A1AA] font-outfitMed tracking-wider uppercase" numberOfLines={1}>
                {greetingText}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.navigate('/profile')}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: '#3A9E66',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#1E3E2B',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            <UserAvatar
              avatarUrl={profile?.avatar_url}
              initials={initials}
              size={32}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Date Selector Row (Updated to match design) */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(400)}
          className="mb-4 flex-row w-full bg-[#08120B] border border-[#162A1B] rounded-[20px] h-[72px] items-center"
        >
          {DATES?.map((d, idx) => {
            const isActive = idx === selectedDateIndex;
            const isLast = idx === (DATES?.length || 0) - 1;
            // Hide the right border if this is active, or the next one is active, or if it's the last item
            const hideBorder = isActive || idx === selectedDateIndex - 1 || isLast;

            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={() => handleDatePress(idx)}
                className={`flex-1 flex-col items-center justify-center h-full relative ${isActive ? "bg-[#0E1E14] border border-[#3A9E66] rounded-[20px] z-10" : "z-0"
                  }`}
              >
                <Text className={`text-[10px] font-outfitBold uppercase tracking-widest mb-1.5 ${isActive ? "text-[#3A9E66]" : "text-[#A1A1AA]"}`}>
                  {d?.day}
                </Text>
                <Text className={`text-[20px] font-outfitBlack ${isActive ? "text-white" : "text-white"}`}>
                  {d?.date}
                </Text>

                {/* Separator line for inactive items */}
                {!hideBorder && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 0,
                      height: 32, // Fixed height instead of percentages
                      width: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    }}
                  />
                )}

                {/* Active Triangle Indicator */}
                {isActive && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: -8,
                      width: 0,
                      height: 0,
                      borderLeftWidth: 8,
                      borderRightWidth: 8,
                      borderTopWidth: 8,
                      borderLeftColor: 'transparent',
                      borderRightColor: 'transparent',
                      borderTopColor: '#3A9E66',
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Level Progress Bar (Compact) */}
        <PremiumLevelCard
          level={rankInfo.rank}
          rankName={rankInfo.name}
          xp={xp}
          nextLevelXp={nextRankInfo.minXp}
        />

        {/* 7-Day Consistency (Now horizontal under rank) */}
        <PremiumStreakCard currentStreak={currentStreak || 0} />

        {/* Grid Layout (Fit on 1 Screen) */}
        <View className="flex-row gap-2.5 mb-2.5">
          {/* LEFT COLUMN */}
          <View className="flex-1 flex-col gap-2.5">
            {/* Push-ups Card */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} className="rounded-2xl border border-[#3A9E66]/30 overflow-hidden h-28 bg-[#121212]/50">
              <GlassSurface>
                <View className="absolute right-2 top-2 opacity-85 z-0">
                  <Image
                    source={PUSHUP_ICON}
                    style={{ width: 74, height: 74 }}
                    contentFit="contain"
                  />
                </View>
                <View className="flex-row justify-between items-start z-10">
                  <Text className="text-[9px] font-outfitBold uppercase tracking-widest text-[#A1A1AA]">Push-ups</Text>
                </View>
                <View className="relative z-10 mt-auto">
                  <Text className="text-2xl font-outfitBlack text-white">{dashboardData?.todayPushupReps || 0}</Text>
                  <Text className="text-[9px] font-outfitBold tracking-widest uppercase text-[#3A9E66]">{isSelectedToday ? "Today's Reps" : "Reps"}</Text>
                </View>
              </GlassSurface>
            </Animated.View>

            {/* Squats Card */}
            <Animated.View entering={FadeInDown.delay(250).duration(400)} className="rounded-2xl border border-[#3A9E66]/30 overflow-hidden h-28 bg-[#121212]/50">
              <GlassSurface>
                <View className="absolute right-2 top-2 opacity-85 z-0">
                  <Image
                    source={SQUAT_ICON}
                    style={{ width: 74, height: 74 }}
                    contentFit="contain"
                  />
                </View>
                <View className="flex-row justify-between items-start z-10">
                  <Text className="text-[9px] font-outfitBold uppercase tracking-widest text-[#A1A1AA]">Squats</Text>
                </View>
                <View className="relative z-10 mt-auto">
                  <Text className="text-2xl font-outfitBlack text-white">{dashboardData?.todaySquatReps || 0}</Text>
                  <Text className="text-[9px] font-outfitBold tracking-widest uppercase text-[#3A9E66]/80">{isSelectedToday ? "Today's Reps" : "Reps"}</Text>
                </View>
              </GlassSurface>
            </Animated.View>

            {/* Total Workouts */}
            <PremiumWorkoutsCard count={totalWorkouts || 0} />
          </View>

          {/* RIGHT COLUMN */}
          <View className="flex-1 flex-col gap-2.5">
            {/* Daily Duration Card */}
            <PremiumDurationCard duration={todayDuration} unit={todayDurationUnit} />

            {/* Planks Card */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="rounded-2xl border border-[#3A9E66]/30 overflow-hidden h-28 bg-[#121212]/50">
              <GlassSurface>
                <View className="absolute right-2 top-2 opacity-85 z-0">
                  <Image
                    source={PLANK_ICON}
                    style={{ width: 74, height: 74 }}
                    contentFit="contain"
                  />
                </View>
                <View className="flex-row justify-between items-start z-10">
                  <Text className="text-[9px] font-outfitBold uppercase tracking-widest text-[#A1A1AA]">Planks</Text>
                </View>
                <View className="relative z-10 mt-auto">
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-2xl font-outfitBlack text-white">{todayPlankVal}</Text>
                    <Text className="text-[10px] font-outfitBold text-[#A1A1AA] uppercase">{todayPlankUnit}</Text>
                  </View>
                  <Text className="text-[9px] font-outfitBold tracking-widest uppercase text-[#3A9E66]/80">{isSelectedToday ? "Today's Time" : "Time"}</Text>
                </View>
              </GlassSurface>
            </Animated.View>

            {/* Calories Burned */}
            <PremiumCaloriesCard estimatedCalories={estimatedCalories} />
          </View>
        </View>

        {/* Active Quests (Compact Carousel) */}
        <ActiveQuestsList quests={activeQuests} calculateProgress={calculateProgress} completedQuests={completedQuests} questMetrics={questMetrics} />
      </View>
    </View>
  );
}