import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, Check, Lock, Mail } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { FloatingLabelInput } from "../../components/ui/FloatingLabelInput";
import { ModalTopBorder } from "../../components/ui/ModalTopBorder";
import { PremiumButton } from "../../components/ui/PremiumButton";
import { analyticsService } from "../../services/core/analyticsService";
import { authService } from "../../services/user/authService";
import { useAuthStore } from "../../store/user/authStore";

const Checkbox = ({ value, onValueChange }: { value: boolean, onValueChange: (val: boolean) => void }) => (
  <TouchableOpacity
    onPress={() => onValueChange(!value)}
    activeOpacity={0.7}
    className={`w-5 h-5 rounded-[6px] border items-center justify-center ${value ? "bg-[#3A9E66] border-[#3A9E66]" : "bg-white/5 border-white/20"
      }`}
  >
    {value && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
  </TouchableOpacity>
);

export default function SignIn() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setError, clearError } = useAuthStore();

  const handleLogin = async () => {
    clearError();
    setLoading(true);
    analyticsService.trackEvent("auth_started", { method: "email", isLogin: true });
    try {
      await AsyncStorage.setItem("REMEMBER_ME_FLAG", rememberMe ? "true" : "false");
      const data = await authService.signIn(email, password);

      // Synchronously update the store to prevent layout race conditions
      if (data?.session) {
        useAuthStore.setState({ session: data.session, user: data.user, isAuthenticated: true });
      }
      router.replace("/(tabs)/home" as any);
    } catch (err: any) {
      analyticsService.trackEvent("auth_failed", { method: "email", isLogin: true, error_code: err.message });
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    clearError();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/welcome");
    }
  };

  return (
    <View className="flex-1 bg-[#09090B]">
      <StatusBar barStyle="light-content" backgroundColor="#09090B" />
      <PremiumAmbientBackground color="#3A9E66" opacity={0.12} />

      {/* Signature Top Green Ambient Gradient */}
      <LinearGradient
        colors={["rgba(58, 158, 102, 0.32)", "rgba(47, 107, 71, 0.12)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
        pointerEvents="none"
      />

      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
          >
            {/* Top Navigation & Header */}
            <Animated.View entering={FadeInDown.duration(600)} className="px-6 pt-4 pb-6">
              <View className="flex-row items-center justify-between mb-6">
                <TouchableOpacity
                  onPress={handleGoBack}
                  activeOpacity={0.7}
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/15 items-center justify-center active:bg-white/20"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ArrowLeft size={20} color="#FFFFFF" />
                </TouchableOpacity>

              </View>

              <View className="mt-2">
                <View className="self-start px-3 py-1 rounded-full bg-[#3A9E66]/15 border border-[#3A9E66]/30 mb-3">
                  <Text className="text-[11px] font-outfitBold uppercase tracking-[2px] text-[#4ADE80]">
                    Login
                  </Text>
                </View>
                <Text className="text-[34px] font-outfitBold tracking-tight text-white leading-[40px]">
                  Welcome{"\n"}
                  <Text className="text-[#3A9E66]">back.</Text>
                </Text>
                <Text className="text-[14px] font-outfitReg text-zinc-400 mt-2 leading-relaxed">
                  Sign in with your email to continue your journey and sync your workout progression.
                </Text>
              </View>
            </Animated.View>

            {/* Bottom Elevated Card */}
            <Animated.View
              entering={FadeInUp.delay(150).duration(700)}
              className="bg-[#141418] rounded-t-[36px] overflow-hidden relative px-6 pt-6 pb-8 shadow-2xl"
            >
              <ModalTopBorder theme="emerald" />
              <View className="z-10">
                {/* Inputs */}
                <View className="mb-4">
                  {/* Email Input */}
                  <FloatingLabelInput
                    label="Email Address"
                    icon={<Mail size={18} color="#3A9E66" />}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                    containerStyle="mb-3.5"
                  />

                  {/* Password Input */}
                  <FloatingLabelInput
                    label="Password"
                    icon={<Lock size={18} color="#3A9E66" />}
                    value={password}
                    onChangeText={setPassword}
                    isPassword
                    editable={!loading}
                    containerStyle="mb-0"
                  />
                </View>

                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row items-center">
                    <Checkbox value={rememberMe} onValueChange={setRememberMe} />
                    <Text className="text-xs font-outfitReg text-zinc-300 ml-2">Remember me</Text>
                  </View>
                  <TouchableOpacity onPress={() => { clearError(); router.push("/(auth)/forgot-password"); }}>
                    <Text className="text-xs font-outfitMed text-[#3A9E66]">Forgot Password?</Text>
                  </TouchableOpacity>
                </View>

                {/* Submit Button */}
                <PremiumButton
                  title="Sign In"
                  onPress={handleLogin}
                  loading={loading}
                  disabled={loading}
                  className="mb-5"
                />
              </View>

              {/* Footer */}
              <View className="items-center pb-2 pt-1 z-10">
                <Text className="text-sm font-outfitReg text-zinc-400">
                  Don't have an account?{" "}
                  <Text
                    onPress={() => { clearError(); router.push("/(auth)/signup"); }}
                    className="text-[#4ADE80] font-outfitBold"
                  >
                    Sign Up
                  </Text>
                </Text>
              </View>

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
