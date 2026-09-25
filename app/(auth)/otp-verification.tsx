import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { PremiumButton } from "../../components/ui/PremiumButton";
import { ModalTopBorder } from "../../components/ui/ModalTopBorder";
import { analyticsService } from "../../services/core/analyticsService";
import { authService, otpRateLimiter } from "../../services/user/authService";
import { useAuthStore } from "../../store/user/authStore";

const CODE_LENGTH = 6;

export default function OtpVerification() {
  const router = useRouter();
  const { email, type } = useLocalSearchParams<{ email: string; type: 'signup' | 'recovery' }>();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const initialCooldown = otpRateLimiter.getRemainingCooldown(email as string, type || 'recovery');
  const [countdown, setCountdown] = useState(initialCooldown > 0 ? initialCooldown : 60);
  const { setError, setSuccess, clearError } = useAuthStore();
  const inputRef = useRef<TextInput>(null);
  const isVerifyingRef = useRef(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Auto-submit when code reaches 6 digits
  useEffect(() => {
    if (code.length === CODE_LENGTH && !isVerifyingRef.current && !isSuccess) {
      handleVerify();
    }
  }, [code, isSuccess]);

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH || isVerifyingRef.current || isSuccess) return;

    isVerifyingRef.current = true;
    clearError();
    setLoading(true);
    analyticsService.trackEvent("otp_verification_started", { type });

    try {
      if (type === 'recovery') {
        await authService.verifyOtp(email as string, code, 'recovery');
        setIsSuccess(true);
        analyticsService.trackEvent("otp_verification_success", { type: 'recovery' });
        useAuthStore.getState().setRecoveringPassword(true);
        setSuccess("Email verified! Please set your new password.");
        setTimeout(() => {
          router.replace("/(auth)/create-new-password");
        }, 600);
      } else {
        const data = await authService.verifyOtp(email as string, code, 'signup');
        setIsSuccess(true);
        analyticsService.trackEvent("otp_verification_success", { type: 'signup' });

        // Synchronously update session in Zustand store to eliminate auth guard race conditions
        if (data?.session) {
          useAuthStore.setState({
            session: data.session,
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          // Fallback: fetch active session if not directly attached to return data
          const currentSession = await authService.getSession();
          if (currentSession) {
            useAuthStore.setState({
              session: currentSession,
              user: currentSession.user,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        }

        setTimeout(() => {
          router.replace("/(tabs)/home" as any);
        }, 800);
      }
    } catch (err: any) {
      analyticsService.trackEvent("otp_verification_failed", { type, error_code: err.message });
      setError(err.message || "Invalid or expired code. Please try again.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
      isVerifyingRef.current = false;
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    clearError();
    const remaining = otpRateLimiter.getRemainingCooldown(email as string, type || 'recovery');
    if (remaining > 0) {
      setError(`Too many attempts. Please try again in ${otpRateLimiter.formatTime(remaining)}.`);
      setCountdown(remaining);
      return;
    }

    setResending(true);
    analyticsService.trackEvent("otp_resend_requested", { type });

    try {
      await authService.resendOtp(email as string, type || 'recovery');
      const nextCooldown = otpRateLimiter.getRemainingCooldown(email as string, type || 'recovery');
      setCountdown(nextCooldown > 0 ? nextCooldown : 60);
      setSuccess("A new 6-digit code has been sent to your email.");
    } catch (err: any) {
      analyticsService.trackEvent("otp_resend_failed", { type, error_code: err.message });
      setError(err.message || "Failed to resend code. Please try again.");
    } finally {
      setResending(false);
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
                    Verification
                  </Text>
                </View>
                <Text className="text-[34px] font-outfitBold tracking-tight text-white leading-[40px]">
                  Verify your{"\n"}
                  <Text className="text-[#3A9E66]">code.</Text>
                </Text>
                <Text className="text-[14px] font-outfitReg text-zinc-400 mt-2 leading-relaxed">
                  Enter the 6-digit verification code sent to:
                </Text>
                <View className="flex-row items-center self-start max-w-full">
                  <Text className="text-[13px] font-outfitMed text-[#4ADE80]" numberOfLines={1} ellipsizeMode="middle">
                    {email}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Bottom Card */}
            <Animated.View
              entering={FadeInUp.delay(150).duration(700)}
              className="bg-[#141418] rounded-t-[36px] overflow-hidden relative px-6 pt-6 pb-8 shadow-2xl"
            >
              <ModalTopBorder theme="emerald" />

              <View className="z-10">
                {/* OTP Input UI */}
                <View className="mb-8 items-center">
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => inputRef.current?.focus()}
                    className="flex-row justify-between w-full"
                  >
                    {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                      const digit = code[index] || "";
                      const isFocused = code.length === index;
                      return (
                        <View
                          key={index}
                          className={`w-12 h-14 rounded-2xl items-center justify-center border ${isSuccess
                            ? "border-[#3A9E66] bg-[#3A9E66]/20"
                            : isFocused
                              ? "border-[#3A9E66] bg-[#3A9E66]/10"
                              : digit
                                ? "border-white/20 bg-white/[0.06]"
                                : "border-white/10 bg-white/[0.03]"
                            }`}
                        >
                          <Text className={`text-2xl font-outfitBold ${isSuccess ? "text-[#4ADE80]" : "text-white"}`}>
                            {digit}
                          </Text>
                        </View>
                      );
                    })}
                  </TouchableOpacity>

                  {/* Hidden Real Input */}
                  <TextInput
                    ref={inputRef}
                    value={code}
                    onChangeText={(text) => {
                      if (isSuccess || loading) return;
                      const numericText = text.replace(/[^0-9]/g, '');
                      if (numericText.length <= CODE_LENGTH) {
                        setCode(numericText);
                      }
                    }}
                    keyboardType="number-pad"
                    className="absolute opacity-0 w-full h-full"
                    autoFocus
                    editable={!loading && !isSuccess}
                  />
                </View>

                {/* Submit Button */}
                <PremiumButton
                  title={isSuccess ? "Verified!" : "Verify Code"}
                  icon={isSuccess ? <Check size={18} color="#052e16" strokeWidth={3} /> : undefined}
                  iconPosition="left"
                  onPress={handleVerify}
                  loading={loading}
                  disabled={loading || isSuccess || code.length !== CODE_LENGTH}
                  className="mb-5"
                />
              </View>

              <View className="items-center pb-2 pt-1 z-10">
                <Text className="text-sm font-outfitReg text-zinc-400">
                  Didn't receive the code?{" "}
                  <Text
                    className={`font-outfitBold ${countdown > 0 || resending ? "text-zinc-500" : "text-[#4ADE80]"}`}
                    onPress={countdown === 0 && !resending && !isSuccess ? handleResend : undefined}
                  >
                    {resending ? "Sending..." : countdown > 0 ? `Resend in ${otpRateLimiter.formatTime(countdown)}` : "Resend Code"}
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
