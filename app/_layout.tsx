import { useCameraStore } from "@/store/core/cameraStore";
import { toastConfig } from '@/utils/toastConfig';
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { AppState, AppStateStatus, Platform, StatusBar, Text, View } from "react-native";
import Purchases, { CustomerInfo } from "react-native-purchases";
import "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from 'react-native-toast-message';
import { usePushNotifications } from "../hooks/usePushNotifications";
import { premiumService } from "../services/core/premiumService";
import { initializeStreakReminder } from "../services/notifications/scheduleStreakReminder";
import { useAuthStore } from "../store/user/authStore";
import { useSubscriptionStore } from "../store/user/subscriptionStore";
import { PremiumUnlockedModal } from "@/components/modals/PremiumUnlockedModal";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import "./globals.css";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Lock the app to portrait globally by default.
ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);

export default function RootLayout() {

  const { requestPermissions, permissionGranted } = useCameraStore();

  useEffect(() => {
    // App start hotay hi background mein permissions resolve kar lo
    // Taake Workout screen par blank wait time na aaye
    if (permissionGranted === null) {
      requestPermissions();
    }

    // Ensure the streak reminder is bootstrapped on device if it's missing
    initializeStreakReminder();

    // Initialize RevenueCat for purchases
    premiumService.initialize().then(() => {
      useSubscriptionStore.getState().checkExpiration();
      useSubscriptionStore.getState().refreshSubscriptionStatus();
    });

    // 1. Real-time CustomerInfo Update Listener (Instant store update on renewal/expiration/purchase)
    const customerInfoListener = (customerInfo: CustomerInfo) => {
      useSubscriptionStore.getState().updateFromCustomerInfo(customerInfo);
    };
    Purchases.addCustomerInfoUpdateListener(customerInfoListener);

    // 2. AppState Listener (Catches expirations that occurred while app was in background)
    const appStateSubscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        useSubscriptionStore.getState().checkExpiration();
        useSubscriptionStore.getState().refreshSubscriptionStatus();
      }
    });

    // 3. Foreground Expiration Watchdog (Checks every 5s for timestamp expiration in open app)
    const watchdogInterval = setInterval(() => {
      useSubscriptionStore.getState().checkExpiration();
    }, 5000);

    // 4. Periodic RevenueCat Refresh (Checks every 60s if Pro to catch store cancellations)
    const rcRefreshInterval = setInterval(() => {
      const state = useSubscriptionStore.getState();
      if (state.isPro) {
        state.refreshSubscriptionStatus();
      }
    }, 60000);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      appStateSubscription.remove();
      clearInterval(watchdogInterval);
      clearInterval(rcRefreshInterval);
    };
  }, []);

  const [crashError, setCrashError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    OutfitRegular: require("./../assets/fonts/Outfit-Regular.ttf"),
    OutfitMedium: require("./../assets/fonts/Outfit-Medium.ttf"),
    OutfitBold: require("./../assets/fonts/Outfit-Bold.ttf"),
    OutfitBlack: require("./../assets/fonts/Outfit-Black.ttf"),
  });

  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize push notification listeners and token syncing
  usePushNotifications();

  useEffect(() => {
    initialize().catch((e: any) => {
      console.error("Init crash:", e);
      setCrashError(String(e?.message || e));
      SplashScreen.hideAsync(); // make sure splash goes away so we can SEE the error
    });
  }, [initialize]);
  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SystemUI.setBackgroundColorAsync("black");
      SplashScreen.hideAsync();

      const inAuthGroup = segments[0] === "(auth)";
      const inOnboardingGroup = segments[0] === "(onboarding)";
      const isPhysicalMetrics = segments[0] === "(onboarding)" && segments[1] === "physical-metrics";
      const isAuthCallback = segments[0] === "auth-callback";
      const isCreateNewPassword = (segments as string[]).includes("create-new-password");

      if (isAuthenticated && (inAuthGroup || (inOnboardingGroup && !isPhysicalMetrics) || isAuthCallback) && !isCreateNewPassword) {
        // Redirect authenticated users from auth/onboarding to tabs (except physical metrics)
        setTimeout(() => {
          router.replace("/(tabs)/home" as any);
        }, 1);
      } else if (!isAuthenticated && (!inAuthGroup || isAuthCallback) && !inOnboardingGroup && segments[0]) {
        // Redirect unauthenticated users to welcome portal if they try to access protected routes
        setTimeout(() => {
          router.replace("/(auth)/welcome" as any);
        }, 1);
      }
    }
  }, [fontsLoaded, isLoading, isAuthenticated, segments]);

  // Show crash error on screen instead of silently dying
  if (crashError) {
    return (
      <View style={{ flex: 1, backgroundColor: "black", padding: 20, paddingTop: 60 }}>
        <Text style={{ color: "red", fontSize: 16 }}>{crashError}</Text>
      </View>
    );
  }

  if (!fontsLoaded || isLoading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
          <StatusBar barStyle="light-content" hidden={false} />
          <View
            style={{
              flex: 1,
              backgroundColor: '#121212',
              borderTopLeftRadius: 38,
              borderTopRightRadius: 38,
              overflow: 'hidden',
              marginTop: 10,
              borderWidth: 0,
            }}
          >
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#121212' },
                animation: 'slide_from_bottom',
                animationDuration: 300,
              }}
            >
              <Stack.Screen
                name="(onboarding)/onboarding"
                options={{ headerShown: false, animation: 'none' }}
              />
              <Stack.Screen
                name="(auth)/auth-callback"
                options={{ headerShown: false, animation: 'none', presentation: 'transparentModal' }}
              />
              <Stack.Screen
                name="(auth)"
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom'
                }}
              />
              <Stack.Screen
                name="(social)/friend-requests"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom'
                }}
              />
              <Stack.Screen
                name="(social)/search-friends"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom'
                }}
              />
              <Stack.Screen
                name="(social)/friend-profile"
                options={{
                  headerShown: false,
                  presentation: 'transparentModal',
                  animation: 'slide_from_bottom',
                  contentStyle: { backgroundColor: 'transparent' }
                }}
              />
              <Stack.Screen
                name="(workout)"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom'
                }}
              />
              <Stack.Screen
                name="index"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(profile)/settings"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom'
                }}
              />
              <Stack.Screen
                name="(profile)/edit-profile"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom'
                }}
              />
              <Stack.Screen
                name="(profile)/premium"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom'
                }}
              />
            </Stack>
          </View>
        </SafeAreaView>
      </View>
      <PremiumUnlockedModal />
      <OfflineBanner />
      <Toast
        config={toastConfig}
        topOffset={Platform.OS === 'ios' ? 74 : 52}
        visibilityTime={3500}
        swipeable={false}
      />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
