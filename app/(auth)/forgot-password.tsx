import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, Mail } from "lucide-react-native";
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
import { PremiumButton } from "../../components/ui/PremiumButton";
import { ModalTopBorder } from "../../components/ui/ModalTopBorder";
import { authService } from "../../services/user/authService";
import { useAuthStore } from "../../store/user/authStore";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { setError, setSuccess, clearError } = useAuthStore();

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    clearError();
    setLoading(true);
    try {
      await authService.resetPassword(trimmedEmail);
      setSuccess("A 6-digit verification code has been sent to your email.");
      router.push({ pathname: '/(auth)/otp-verification', params: { email: trimmedEmail, type: 'recovery' } });
    } catch (err: any) {
      setError(err.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
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
            contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top Section */}
            <Animated.View entering={FadeInDown.duration(600)} className="px-6 pt-4 pb-6">
              <View className="flex-row items-center justify-between mb-6">
                <TouchableOpacity
                  onPress={() => { clearError(); router.back(); }}
                  activeOpacity={0.7}
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/15 items-center justify-center active:bg-white/20"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ArrowLeft size={20} color="#FFFFFF" />
                </TouchableOpacity>

              </View>

              <View className="mt-1">
                <View className="self-start px-3 py-1 rounded-full bg-[#3A9E66]/15 border border-[#3A9E66]/30 mb-2.5">
                  <Text className="text-[11px] font-outfitBold uppercase tracking-[2px] text-[#4ADE80]">
                    Password Recovery
                  </Text>
                </View>
                <Text className="text-[34px] font-outfitBold tracking-tight text-white leading-[40px]">
                  Forgot your{"\n"}
                  <Text className="text-[#3A9E66]">password?</Text>
                </Text>
                <Text className="text-[14px] font-outfitReg text-zinc-400 mt-2 leading-relaxed">
                  Enter your registered email address and we will send you a 6-digit recovery code.
                </Text>
              </View>
            </Animated.View>

            {/* Bottom Card */}
            <Animated.View
              entering={FadeInUp.delay(150).duration(700)}
              className="bg-[#141418] rounded-t-[36px] overflow-hidden relative px-6 pt-6 pb-8 shadow-2xl"
            >
              <ModalTopBorder theme="emerald" />

              <View className="z-10">
                <View className="mb-6">
                  {/* Email Input */}
                  <FloatingLabelInput
                    label="Email Address"
                    icon={<Mail size={18} color="#3A9E66" />}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                    containerStyle=""
                  />
                </View>

                {/* Submit Button */}
                <PremiumButton
                  title="Send OTP"
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={loading}
                  className="mb-5"
                />
              </View>

              {/* Footer */}
              <View className="items-center pb-2 pt-1 z-10">
                <Text className="text-sm font-outfitReg text-zinc-400">
                  Already know your password?{" "}
                  <Text
                    onPress={() => { clearError(); router.replace("/(auth)/signin"); }}
                    className="text-[#4ADE80] font-outfitBold"
                  >
                    Sign In
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
