import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppleIcon } from "../../components/icons/AppleIcon";
import { GoogleIcon } from "../../components/icons/GoogleIcon";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { analyticsService } from "../../services/core/analyticsService";
import { authService } from "../../services/user/authService";
import { useAuthStore } from "../../store/user/authStore";

export default function WelcomeAuthScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const { setError, clearError } = useAuthStore();

  const isSmallDevice = height < 750;
  const isVerySmallDevice = height < 680;

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    clearError();
    const isGoogle = provider === "google";
    isGoogle ? setIsGoogleLoading(true) : setIsAppleLoading(true);
    analyticsService.trackEvent("auth_started", { method: provider, source: "welcome_screen" });
    try {
      await AsyncStorage.setItem("REMEMBER_ME_FLAG", "true");
      await authService.signInWithOAuth(provider);

      const session = await authService.getSession();
      if (session) {
        useAuthStore.setState({ session, user: session.user, isAuthenticated: true });
      }
      router.replace("/(tabs)/home" as any);
    } catch (err: any) {
      analyticsService.trackEvent("auth_failed", { method: provider, error_code: err.message });
      setError(err.message || `Failed to sign in with ${provider}`);
    } finally {
      isGoogle ? setIsGoogleLoading(false) : setIsAppleLoading(false);
    }
  };

  const isAnyLoading = isGoogleLoading || isAppleLoading;

  // Responsive typography & sizing for fixed screen
  const titleFontSize = isVerySmallDevice ? 32 : isSmallDevice ? 36 : 42;
  const titleLineHeight = isVerySmallDevice ? 38 : isSmallDevice ? 44 : 50;
  const buttonHeight = isSmallDevice ? 48 : 54;
  const buttonSpacing = isSmallDevice ? 8 : 12;

  return (
    <View className="flex-1 bg-[#09090B]">
      <StatusBar barStyle="light-content" backgroundColor="#09090B" />
      <PremiumAmbientBackground color="#3A9E66" opacity={0.12} />

      {/* Signature Top Green Ambient Gradient */}
      <LinearGradient
        colors={["rgba(58, 158, 102, 0.35)", "rgba(47, 107, 71, 0.15)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
        pointerEvents="none"
      />

      <SafeAreaView
        className="flex-1 justify-between"
        style={{
          paddingHorizontal: isSmallDevice ? 22 : 28,
          paddingVertical: isSmallDevice ? 12 : 20,
        }}
        edges={["top", "bottom", "left", "right"]}
      >
        {/* Top Header / Clean Brand Mark Centered */}
        <Animated.View entering={FadeInDown.duration(600)} className="pt-1 items-center">
          <View className="flex-row items-baseline">
            <Text className="text-[24px] uppercase font-outfitBold text-white tracking-tight">
              Replix
            </Text>
          </View>
        </Animated.View>

        {/* Center Hero Section - Centered 3-line Heading & 2-line Description */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(700)}
          className="my-auto py-2 items-center max-w-[440px] w-full self-center"
        >
          <Text
            style={{
              fontSize: titleFontSize,
              lineHeight: titleLineHeight,
            }}
            className="font-outfitBold tracking-tight text-white text-center pb-2 mb-2"
          >
            Train,{"\n"}
            compete and{"\n"}
            <Text className="text-[#3A9E66]">progress.</Text>
          </Text>
          <Text
            style={{
              fontSize: isSmallDevice ? 13.5 : 15,
              lineHeight: isSmallDevice ? 20 : 22,
              maxWidth: isSmallDevice ? 260 : 280,
            }}
            className="font-outfitReg text-[#A1A1AA] text-center"
          >
            Smart rep counting, detailed analytics, and leaderboards to push your limits.
          </Text>
        </Animated.View>

        {/* Bottom Actions Stack - Platform Optimized Social Auth */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(700)}
          className="w-full max-w-[440px] self-center pb-1"
        >
          {/* iOS: Continue with Apple (Top Priority) */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              onPress={() => handleOAuthSignIn("apple")}
              disabled={isAnyLoading}
              activeOpacity={0.88}
              style={{ height: buttonHeight, marginBottom: buttonSpacing }}
              className={`w-full bg-[#18181B] border border-[#27272A] rounded-2xl flex-row items-center justify-center px-4 shadow-xl shadow-black/40 ${
                isAnyLoading ? "opacity-60" : "active:scale-[0.99]"
              }`}
            >
              {isAppleLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <View className="w-6 items-center justify-center">
                    <AppleIcon width={20} height={20} color="#FFFFFF" />
                  </View>
                  <Text className="font-outfitBold text-white text-[15px] ml-3">
                    Continue with Apple
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Continue with Google (iOS & Android) */}
          <TouchableOpacity
            onPress={() => handleOAuthSignIn("google")}
            disabled={isAnyLoading}
            activeOpacity={0.88}
            style={{ height: buttonHeight, marginBottom: buttonSpacing }}
            className={`w-full bg-white rounded-2xl flex-row items-center justify-center px-4 shadow-xl shadow-black/40 ${
              isAnyLoading ? "opacity-60" : "active:scale-[0.99]"
            }`}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color="#09090B" />
            ) : (
              <>
                <View className="w-6 items-center justify-center">
                  <GoogleIcon width={20} height={20} />
                </View>
                <Text className="font-outfitBold text-[#09090B] text-[15px] ml-3">
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Subtle Divider */}
          <View className="flex-row items-center my-1.5">
            <View className="flex-1 h-[1px] bg-white/[0.08]" />
            <Text className="mx-3 text-[11px] font-outfitMed text-[#71717A] uppercase tracking-widest">
              or
            </Text>
            <View className="flex-1 h-[1px] bg-white/[0.08]" />
          </View>

          {/* Continue with Email */}
          <TouchableOpacity
            onPress={() => {
              clearError();
              router.push("/(auth)/signup");
            }}
            disabled={isAnyLoading}
            activeOpacity={0.85}
            style={{ height: buttonHeight, marginBottom: isSmallDevice ? 10 : 14 }}
            className={`w-full bg-[#121212] border border-[#3A9E66]/40 rounded-2xl flex-row items-center justify-center px-4 ${
              isAnyLoading ? "opacity-60" : "active:scale-[0.99]"
            }`}
          >
            <View className="w-6 items-center justify-center">
              <Mail size={18} color="#3A9E66" />
            </View>
            <Text className="font-outfitBold text-[#3A9E66] text-[15px] ml-3">
              Continue with Email
            </Text>
          </TouchableOpacity>

          {/* Secondary Sign In Link */}
          <View className="flex-row items-center justify-center mb-2.5">
            <Text className="text-[13px] font-outfitReg text-[#71717A]">
              Already have an account?{" "}
            </Text>
            <TouchableOpacity
              onPress={() => {
                clearError();
                router.push("/(auth)/signin");
              }}
              disabled={isAnyLoading}
              activeOpacity={0.7}
            >
              <Text className="text-[13px] font-outfitBold text-[#3A9E66]">
                Log In
              </Text>
            </TouchableOpacity>
          </View>

          {/* Legal / Privacy Footer */}
          <Text className="text-[11px] font-outfitReg text-[#52525B] text-center leading-normal px-2">
            By continuing, you agree to Replix's{" "}
            <Text className="text-[#8FAE8E]">Terms of Service</Text> and{" "}
            <Text className="text-[#8FAE8E]">Privacy Charter</Text>.
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
