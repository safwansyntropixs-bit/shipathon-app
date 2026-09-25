import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Image, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { useDashboardStore } from "../../store/workout/dashboardStore";
import { useTrophyStore } from "../../store/gamification/trophyStore";
import { TROPHY_DETAILS } from "../../constants/gamification";

const { width } = Dimensions.get('window');

export default function AchievementDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const trophyId = Array.isArray(id) ? id[0] : id;
  const trophies = Object.values(TROPHY_DETAILS);
  const initialIndex = Math.max(0, trophies.findIndex(t => t.id === trophyId));

  const unlockedTrophies = useTrophyStore((s) => s.unlockedTrophies);
  const getTrophyRarity = useTrophyStore((s) => s.getTrophyRarity);
  const dashboardData = useDashboardStore((s) => s.data);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [rarityMap, setRarityMap] = useState<Record<string, string>>({});

  const activeTrophy = trophies[activeIndex] || trophies[0];

  const scrollX = useSharedValue(initialIndex * width);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  useEffect(() => {
    let isMounted = true;
    const fetchAllRarities = async () => {
      const newMap: Record<string, string> = {};
      for (const t of trophies) {
        const val = await getTrophyRarity(t.id);
        newMap[t.id] = val === 0 ? "Top 0.1%" : `Top ${val}%`;
      }
      if (isMounted) setRarityMap(newMap);
    };
    fetchAllRarities();
    return () => { isMounted = false; };
  }, []);

  const renderTrophyCard = ({ item: trophy }: { item: any }) => {
    const isUnlocked = unlockedTrophies.some((t) => t.id === trophy.id);
    let currentProgress = 0;

    if (isUnlocked) {
      currentProgress = trophy.target;
    } else {
      switch (trophy.id) {
        case 'the_centurion':
          currentProgress = dashboardData.totalSessions;
          break;
        case 'gravity_defiant':
          currentProgress = dashboardData.totalVolume;
          break;
        case 'the_juggernaut':
        case 'the_statue':
        case 'the_surgeon':
          // Single-session achievements do not have cumulative lifetime progress.
          // They are binary: either you did it in one session, or you didn't.
          currentProgress = 0;
          break;
        default:
          currentProgress = 0;
      }

      currentProgress = Math.min(currentProgress, trophy.target - 1);
      currentProgress = Math.floor(currentProgress);
    }

    const progressPercent = Math.min(Math.max((currentProgress / trophy.target) * 100, 0), 100);
    const remaining = Math.max(0, trophy.target - currentProgress);
    const rarity = rarityMap[trophy.id];

    return (
      <ScrollView className="flex-1 px-5 pt-2 pb-6" style={{ width }} showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="text-2xl font-outfitBold text-white tracking-tight">
            Achievement badges
          </Text>
          <Text className="text-xs text-white/40 font-outfitReg mt-1">
            Swipe to explore more
          </Text>
        </View>

        <Animated.View
          entering={FadeInDown.delay(150).duration(400)}
          className="w-full rounded-3xl p-5 border shadow-2xl"
          style={{
            backgroundColor: '#111111',
            borderColor: `${trophy.accentColor}30`,
            shadowColor: trophy.accentColor,
            shadowOpacity: 0.15,
            shadowRadius: 30,
            elevation: 20
          }}
        >
          <View className="flex-row mb-6">
            <View className="w-32 h-32 relative items-center justify-center mr-4">
              <Image
                source={trophy.image}
                style={{ width: '100%', height: '100%', resizeMode: 'contain', zIndex: 10 }}
                className={isUnlocked ? "" : "opacity-30"}
              />
            </View>

            <View className="flex-1 justify-center pt-2">
              <View
                className="self-start px-2.5 py-0.5 rounded-full border mb-1.5"
                style={{ backgroundColor: `${trophy.accentColor}15`, borderColor: `${trophy.accentColor}30` }}
              >
                <Text
                  className="text-[9px] font-outfitBold uppercase tracking-widest"
                  style={{ color: trophy.accentColor }}
                >
                  {trophy.rarity}
                </Text>
              </View>

              <Text className="text-xl font-outfitBold text-white tracking-wider uppercase mb-0.5">
                {trophy.title}
              </Text>

              <Text
                className="text-[11px] font-outfitBold mb-2"
                style={{ color: trophy.accentColor }}
              >
                {trophy.subtitle}
              </Text>

              <Text className="text-[10px] text-white/40 font-outfitReg leading-tight">
                {trophy.description}
              </Text>
            </View>
          </View>

          <View className="mb-2">
            {['the_juggernaut', 'the_statue', 'the_surgeon'].includes(trophy.id) ? (
              // Binary / Single-Session Trophy UI
              <View className="bg-white/5 border border-white/10 rounded-xl p-3 flex-row items-center justify-between">
                <Text className="text-[10px] font-outfitMed text-white/40 uppercase tracking-widest">
                  Challenge Type
                </Text>
                <Text className="text-[11px] font-outfitBold text-white">
                  Single-Session Feat
                </Text>
              </View>
            ) : (
              // Cumulative Trophy Progress Bar UI
              <>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-[10px] font-outfitMed text-white/40">
                    Progress
                  </Text>
                  <Text
                    className="text-[11px] font-outfitBold"
                    style={{ color: trophy.accentColor }}
                  >
                    {Math.round(currentProgress).toLocaleString()}{trophy.unit} / {trophy.target.toLocaleString()}{trophy.unit}
                  </Text>
                </View>
  
                <View className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${progressPercent}%`, backgroundColor: trophy.accentColor }}
                  />
                </View>
  
                <Text className="text-[9px] font-outfitMed text-white/30">
                  {isUnlocked ? "Achievement Unlocked!" : `${Math.round(remaining).toLocaleString()}${trophy.unit} remaining to unlock`}
                </Text>
              </>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(400)} className="mt-8 mb-10">
          <Text className="text-[10px] font-outfitBold uppercase tracking-widest text-[#A1A1AA] mb-4">
            Trophy Intelligence
          </Text>

          <View className="flex-row gap-3">
            <View className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl items-center justify-center min-h-[72px]">
              <Text className="text-[10px] font-outfitMed text-white/40 mb-1">Global Rarity</Text>
              {rarity ? (
                <Text className="text-lg font-outfitBold" style={{ color: trophy.accentColor }}>{rarity}</Text>
              ) : (
                <ActivityIndicator size="small" color={trophy.accentColor} />
              )}
            </View>
            <View className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl items-center">
              <Text className="text-[10px] font-outfitMed text-white/40 mb-1">Status</Text>
              <Text
                className="text-lg font-outfitBold"
                style={{ color: isUnlocked ? trophy.accentColor : '#A1A1AA' }}
              >
                {isUnlocked ? "Secured" : "Locked"}
              </Text>
            </View>
          </View>

          {isUnlocked && unlockedTrophies.find(t => t.id === trophy.id)?.created_at && (
            <View className="mt-3 bg-white/5 border border-white/10 p-4 rounded-2xl flex-row items-center justify-between">
              <Text className="text-[11px] font-outfitMed text-white/60">Acquired Date</Text>
              <Text className="text-sm font-outfitBold text-white">
                {new Date(unlockedTrophies.find(t => t.id === trophy.id)!.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    );
  };

  return (
    <View className="flex-1 pt-4 bg-[#050505]">
      {trophies.map((t, index) => {
        const bgStyle = useAnimatedStyle(() => {
          const opacity = interpolate(
            scrollX.value,
            [(index - 1) * width, index * width, (index + 1) * width],
            [0, 1, 0],
            Extrapolation.CLAMP
          );
          return { opacity, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 };
        });

        return (
          <Animated.View key={`bg-${t.id}`} style={bgStyle} pointerEvents="none">
            <PremiumAmbientBackground color={t.accentColor} opacity={0.15} />
          </Animated.View>
        );
      })}

      <SafeAreaView className="flex-1 z-10">
        <View className="flex-row items-center justify-between mb-4 mt-2 px-5 z-10">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-white/5 border border-white/10"
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Animated.FlatList
          data={trophies}
          keyExtractor={(t) => t.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={renderTrophyCard}
        />
      </SafeAreaView>
    </View>
  );
}
