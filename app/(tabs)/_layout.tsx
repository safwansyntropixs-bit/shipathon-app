import { BlurView } from "expo-blur";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { AppState, Dimensions, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useFriendStore } from "../../store/social/friendStore";
import { useAuthStore } from "../../store/user/authStore";
// Reanimated imported for zero-lag UI thread animations
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 90 : 63;
const GradientDefs = () => (
  <Defs>
    <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0%" stopColor="#6EE7A0" />
      <Stop offset="100%" stopColor="#1A7A3C" />
    </LinearGradient>
  </Defs>
);

const HomeIcon = ({ isFocused, color }: any) => (
  <Svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
    <GradientDefs />
    <Path fill="url(#g)" d="M3.15 10.45 12 3l8.85 7.45a.9.9 0 0 1-1.16 1.38L18.9 11v8.55c0 .8-.65 1.45-1.45 1.45h-3.5v-6.25h-3.9V21h-3.5A1.45 1.45 0 0 1 5.1 19.55V11l-.79.83a.9.9 0 1 1-1.16-1.38Z" />
  </Svg>
);

const WorkoutsIcon = ({ isFocused, color }: any) => (
  <Svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
    <GradientDefs />
    <G fill="url(#g)">
      <Rect x="3.1" y="8.15" width="2.35" height="7.7" rx="1.05" />
      <Rect x="5.75" y="6.05" width="2.25" height="11.9" rx="1.05" />
      <Rect x="8.1" y="10.15" width="7.8" height="3.7" rx="1.15" />
      <Rect x="15.95" y="6.05" width="2.25" height="11.9" rx="1.05" />
      <Rect x="18.55" y="8.15" width="2.35" height="7.7" rx="1.05" />
    </G>
  </Svg>
);

const AnalyticsIcon = ({ isFocused, color }: any) => (
  <Svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
    <GradientDefs />
    <G fill="url(#g)">
      <Rect x="3.25" y="13.15" width="4.05" height="7.6" rx="1.05" />
      <Rect x="8.35" y="9.15" width="4.05" height="11.6" rx="1.05" />
      <Rect x="13.45" y="5.15" width="4.05" height="15.6" rx="1.05" />
    </G>
  </Svg>
);

const RankingsIcon = ({ isFocused, color }: any) => (
  <Svg viewBox="0 0 29 26" fill="none" width={24} height={24}>
    <GradientDefs />
    <Path d="M5.66669 0H22.6667V11.3333C22.6667 13.5877 21.7712 15.7497 20.1771 17.3437C18.583 18.9378 16.421 19.8333 14.1667 19.8333C11.9123 19.8333 9.75034 18.9378 8.15628 17.3437C6.56222 15.7497 5.66669 13.5877 5.66669 11.3333V0Z" fill="url(#g)" />
    <Path d="M5.66669 5.66667H1.41669C1.41669 6.79384 1.86445 7.87484 2.66148 8.67187C3.45851 9.4689 4.53952 9.91667 5.66669 9.91667M22.6667 5.66667H26.9167C26.9167 6.79384 26.4689 7.87484 25.6719 8.67187C24.8749 9.4689 23.7939 9.91667 22.6667 9.91667" stroke="url(#g)" strokeWidth="2.83333" strokeLinecap="round" />
    <Path d="M17.7084 19.8333H10.625C10.2338 19.8333 9.91669 20.1505 9.91669 20.5417V21.9583C9.91669 22.3495 10.2338 22.6667 10.625 22.6667H17.7084C18.0996 22.6667 18.4167 22.3495 18.4167 21.9583V20.5417C18.4167 20.1505 18.0996 19.8333 17.7084 19.8333Z" fill="url(#g)" />
    <Path d="M19.8334 22.6667H8.50004C7.71764 22.6667 7.08337 23.3009 7.08337 24.0833C7.08337 24.8657 7.71764 25.5 8.50004 25.5H19.8334C20.6158 25.5 21.25 24.8657 21.25 24.0833C21.25 23.3009 20.6158 22.6667 19.8334 22.6667Z" fill="url(#g)" />
    <Path d="M14.1667 4.25L15.4417 7.93333H19.8333L16.2917 10.4833L17.5667 14.1667L14.1667 11.9L10.7667 14.1667L12.0417 10.4833L8.5 7.93333H12.8917L14.1667 4.25Z" fill="#0D1A0F" />
  </Svg>
);

const ProfileIcon = ({ isFocused, color }: any) => (
  <Svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
    <GradientDefs />
    <G fill="url(#g)">
      <Ellipse cx="12" cy="7.15" rx="3.45" ry="3.65" />
      <Path d="M5.1 20.55c.38-4.1 2.72-6.55 6.9-6.55s6.52 2.45 6.9 6.55c.04.44-.3.8-.74.8H5.84a.75.75 0 0 1-.74-.8Z" />
    </G>
  </Svg>
);

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const routes = state.routes;
  const translateX = useSharedValue(0);
  const tabWidth = (SCREEN_WIDTH - 48) / routes.length;

  useEffect(() => {
    const activeIndex = state.index;
    const targetTranslateX = 8 + (activeIndex * tabWidth) + (tabWidth / 2) - 28; // 28 is half of 56 width

    translateX.value = withSpring(targetTranslateX, {
      damping: 15,
      stiffness: 120,
      mass: 0.8
    });
  }, [state.index]);

  const animatedCircleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={styles.tabBarContainer}>
      <BlurView intensity={25} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(26, 26, 26, 0.5)' }]} />

      {/* Moving Solid Active Capsule */}
      <Animated.View style={[{
        position: 'absolute',
        top: 8, // Vertically aligns with the icon center
        width: 56,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A3D2C', // Solid border color from Figma
        overflow: 'hidden',
      }, animatedCircleStyle]}>
        <ExpoLinearGradient
          colors={['#1A2E1C', '#111C12']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.tabsWrapper}>
        {routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              isFocused={isFocused}
              onPress={onPress}
              routeName={route.name}
              title={options.title || route.name}
            />
          );
        })}
      </View>
    </View>
  );
};

const TabItem = ({ isFocused, onPress, routeName, title }: any) => {
  const friendStore = useFriendStore();
  const hasIncomingRequests = routeName === "leaderboard" && friendStore.incomingRequests.length > 0;

  // Reanimated Shared Values for Icon and Text bouncing
  const translateY = useSharedValue(isFocused ? -2 : 0);
  const textTranslateY = useSharedValue(0);
  const scale = useSharedValue(isFocused ? 1.1 : 1);

  useEffect(() => {
    // 60FPS UI Thread Spring Animation
    translateY.value = withSpring(isFocused ? -2 : 0, {
      damping: 12,
      stiffness: 150,
      mass: 0.8
    });

    scale.value = withSpring(isFocused ? 1.1 : 1, {
      damping: 12,
      stiffness: 150,
    });

    textTranslateY.value = withSpring(0, {
      damping: 12,
      stiffness: 150,
    });
  }, [isFocused]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: textTranslateY.value }],
  }));

  const renderIcon = (color: string) => {
    switch (routeName) {
      case "home": return <HomeIcon isFocused={isFocused} color={color} />;
      case "workouts": return <WorkoutsIcon isFocused={isFocused} color={color} />;
      case "analytics": return <AnalyticsIcon isFocused={isFocused} color={color} />;
      case "leaderboard": return <RankingsIcon isFocused={isFocused} color={color} />;
      case "profile": return <ProfileIcon isFocused={isFocused} color={color} />;
      default: return <HomeIcon isFocused={isFocused} color={color} />;
    }
  };

  const color = isFocused ? "#FFFFFF" : "#A1A1AA";
  const textColor = isFocused ? "#FFFFFF" : "#A1A1AA";

  return (
    <TouchableOpacity onPress={onPress} style={styles.tabItem} activeOpacity={0.8}>
      <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
        {renderIcon(color)}
        {hasIncomingRequests && (
          <View className="absolute top-0 right-1 w-2 h-2 bg-white rounded-full" />
        )}
      </Animated.View>
      <Animated.Text style={[styles.tabText, { color: textColor }, textAnimatedStyle]}>
        {title.charAt(0).toUpperCase() + title.slice(1)}
      </Animated.Text>
    </TouchableOpacity>
  );
};

import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { CelebrationModal } from "../../components/modals/CelebrationModal";
import { UsernameSetupModal } from "../../components/modals/UsernameSetupModal";
import { useRecapStore } from "../../store/gamification/recapStore";
import { useProfileStore } from "../../store/user/profileStore";

export default function TabLayout() {
  const { user } = useAuthStore();
  const friendStore = useFriendStore();
  const profileStore = useProfileStore();
  const router = useRouter();
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  const {
    triggerCelebration,
    isOpen: isCelebrationOpen,
    closeCelebration,
    activeData: celebrationData,
  } = useRecapStore();

  useEffect(() => {
    let weekTimer: ReturnType<typeof setTimeout>;
    let monthTimer: ReturnType<typeof setTimeout>;

    const checkRecaps = () => {
      if (user?.id && user.id !== "guest") {
        void useRecapStore.getState().checkAutomaticCelebrations(user.id);
      }
    };

    if (user?.id && user.id !== "guest") {
      void friendStore.loadFriends(user.id);
      void friendStore.loadRequests(user.id);
      void profileStore.fetchProfile();
      checkRecaps();

      const now = new Date();

      // 1. Calculate ms until Sunday 23:59:59.999 UTC
      const currentUtcDay = now.getUTCDay();
      const daysUntilSunday = currentUtcDay === 0 ? 0 : 7 - currentUtcDay;

      const targetSundayUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + daysUntilSunday,
        23, 59, 59, 999
      ));

      let msUntilWeekEnd = targetSundayUTC.getTime() - now.getTime();
      if (msUntilWeekEnd <= 0) {
        targetSundayUTC.setUTCDate(targetSundayUTC.getUTCDate() + 7);
        msUntilWeekEnd = targetSundayUTC.getTime() - now.getTime();
      }

      // Set timer to show celebration +2 seconds after the week ends if user is in-app
      if (msUntilWeekEnd > 0 && msUntilWeekEnd < 2147483647) {
        weekTimer = setTimeout(() => {
          if (user?.id && user.id !== "guest") {
            void useRecapStore.getState().checkAutomaticCelebrations(user.id, true);
          }
        }, msUntilWeekEnd + 2000);
      }

      // 2. Calculate ms until Month End 23:59:59.999 UTC
      const targetMonthEndUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        0, // Last day of current UTC month
        23, 59, 59, 999
      ));

      let msUntilMonthEnd = targetMonthEndUTC.getTime() - now.getTime();
      if (msUntilMonthEnd <= 0) {
        const nextMonthEnd = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 2,
          0,
          23, 59, 59, 999
        ));
        msUntilMonthEnd = nextMonthEnd.getTime() - now.getTime();
      }

      // Set timer to show celebration +2 seconds after the month ends if user is in-app
      if (msUntilMonthEnd > 0 && msUntilMonthEnd < 2147483647) {
        monthTimer = setTimeout(() => {
          if (user?.id && user.id !== "guest") {
            void useRecapStore.getState().checkAutomaticCelebrations(user.id, true);
          }
        }, msUntilMonthEnd + 2000);
      }
    }

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") checkRecaps();
    });

    return () => {
      if (weekTimer) clearTimeout(weekTimer);
      if (monthTimer) clearTimeout(monthTimer);
      subscription.remove();
    };
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && profileStore.profile && !profileStore.isLoading) {

      // 1. Check Physical Metrics Onboarding First
      if (!profileStore.profile.weight_kg || !profileStore.profile.height_cm || !profileStore.profile.age || !profileStore.profile.gender) {
        // Redirect to physical metrics onboarding if any of these are missing
        router.replace("/(onboarding)/physical-metrics");
        return;
      }

      // 2. Check Username Setup
      const username = profileStore.profile.username?.trim();
      const needsUsername =
        !username ||
        username === "" ||
        username.startsWith("New User") ||
        username.includes("@");

      if (needsUsername) {
        setShowUsernameModal(true);
      } else {
        setShowUsernameModal(false);
      }
    }
  }, [user?.id, profileStore.profile, profileStore.isLoading]);

  return (
    <>
      <PremiumAmbientBackground />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      >
        <Tabs.Screen name="home" options={{ title: "Home" }} />
        <Tabs.Screen name="workouts" options={{ title: "Workouts" }} />
        <Tabs.Screen name="analytics" options={{ title: "Analytics" }} />
        <Tabs.Screen name="leaderboard" options={{ title: "Rankings" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>

      {user?.id && (
        <UsernameSetupModal
          visible={showUsernameModal}
          userId={user.id}
          onComplete={() => setShowUsernameModal(false)}
        />
      )}

      {celebrationData && (
        <CelebrationModal
          visible={isCelebrationOpen}
          onClose={closeCelebration}
          data={celebrationData}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    bottom: Platform.OS === 'ios' ? 3 : 2,
    left: 16,
    right: 16,
    height: 62,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "transparent",
  },
  tabsWrapper: {
    flexDirection: "row",
    flex: 1,
    paddingHorizontal: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 40,
    zIndex: 2,
  },
  tabText: {
    fontFamily: "OutfitMedium",
    fontSize: 10,
    marginTop: -4,
  },
});