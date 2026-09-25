import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from "react-native";
import { CheckCircle, XCircle, AtSign, Sparkles } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { usernameService } from "@/services/user/usernameService";
import { profileService } from "@/services/user/profileService";
import { useProfileStore } from "@/store/user/profileStore";
import { ModalTopBorder } from "../ui/ModalTopBorder";
import { formatUserErrorMessage } from "@/utils/errorUtils";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface UsernameSetupModalProps {
  visible: boolean;
  userId: string;
  onComplete: (newUsername: string) => void;
}

export function UsernameSetupModal({
  visible,
  userId,
  onComplete,
}: UsernameSetupModalProps) {
  const [usernameInput, setUsernameInput] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const keyboardShift = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const profileStore = useProfileStore();

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        if (Platform.OS === "ios") {
          keyboardShift.value = withTiming(e.endCoordinates.height, {
            duration: 250,
            easing: Easing.out(Easing.cubic),
          });
        } else {
          // Instant snap on Android to eliminate perceived animation lag
          keyboardShift.value = e.endCoordinates.height;
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        if (Platform.OS === "ios") {
          keyboardShift.value = withTiming(0, {
            duration: 250,
            easing: Easing.out(Easing.cubic),
          });
        } else {
          keyboardShift.value = 0;
        }
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 250 });
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 250,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [visible]);

  // Debounced real-time availability checking
  useEffect(() => {
    const clean = usernameService.formatUsername(usernameInput);

    if (!clean) {
      setIsChecking(false);
      setIsAvailable(null);
      setStatusMessage("");
      return;
    }

    const formatCheck = usernameService.validateFormat(clean);
    if (!formatCheck.isValid) {
      setIsChecking(false);
      setIsAvailable(false);
      setStatusMessage(formatCheck.message);
      return;
    }

    setIsChecking(true);
    setStatusMessage("Checking availability...");
    setIsAvailable(null);

    const timer = setTimeout(async () => {
      const res = await usernameService.checkAvailability(clean, userId);
      setIsChecking(false);
      setIsAvailable(res.isAvailable);
      setStatusMessage(res.message);
    }, 500);

    return () => clearTimeout(timer);
  }, [usernameInput, userId]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboardShift.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleSave = async () => {
    const clean = usernameService.formatUsername(usernameInput);
    if (!clean || !isAvailable || isChecking || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await profileService.updateProfile(userId, { username: clean });
      if (userId) {
        await profileStore.fetchProfile(true);
      }
      
      // Animate out
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(
        SCREEN_HEIGHT,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        () => {
          runOnJS(onComplete)(clean);
        }
      );
    } catch (err: any) {
      setIsAvailable(false);
      setStatusMessage(formatUserErrorMessage(err, "Failed to update username"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={() => {}}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 justify-end">
          {/* Semi-transparent Backdrop */}
          <Animated.View
            style={[animatedBackdropStyle]}
            className="absolute inset-0 bg-black/70"
          />

          {/* Bottom Sheet Card */}
          <Animated.View
            style={[animatedSheetStyle]}
            className="w-full bg-[#141418] rounded-t-[32px] overflow-hidden p-6 pb-8 shadow-2xl relative"
          >
            <ModalTopBorder theme="emerald" />
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                {/* Header Icon & Title */}
                <View className="items-center mb-5">
                  
                  <Text className="text-xl font-outfitBold text-brand-charcoal text-center">
                    Claim Your Unique @handle
                  </Text>
                  <Text className="text-xs font-outfitReg text-brand-grey text-center mt-1 px-4">
                    Set your handle to appear on Leaderboards and allow friends to find you instantly.
                  </Text>
                </View>

                {/* Input Box with Status */}
                <View className="mb-5">
                  <View
                    className={`flex-row items-center h-14 bg-brand-card border rounded-2xl px-4 ${
                      isAvailable === true
                        ? "border-brand-success"
                        : isAvailable === false
                        ? "border-brand-error"
                        : "border-brand-divider"
                    }`}
                  >
                    <AtSign size={20} color="#9F9F99" className="mr-2" />
                    <TextInput
                      value={usernameInput}
                      onChangeText={(val) => setUsernameInput(usernameService.formatUsername(val))}
                      placeholder="username"
                      placeholderTextColor="#8E8E93"
                      className="flex-1 text-sm font-outfitBold text-brand-charcoal h-full"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={15}
                    />

                    {/* Status Indicator */}
                    {isChecking && <ActivityIndicator size="small" color="#9F9F99" />}
                    {!isChecking && isAvailable === true && (
                      <CheckCircle size={20} color="#3FA76A" />
                    )}
                    {!isChecking && isAvailable === false && (
                      <XCircle size={20} color="#D85C5C" />
                    )}
                  </View>

                  {/* Helper Status Message */}
                  {statusMessage ? (
                    <Text
                      className={`text-[11px] font-outfitMed mt-2 px-1 ${
                        isAvailable === true
                          ? "text-brand-success"
                          : isAvailable === false
                          ? "text-brand-error"
                          : "text-brand-grey"
                      }`}
                    >
                      {statusMessage}
                    </Text>
                  ) : null}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={!isAvailable || isChecking || isSubmitting || !usernameInput}
                  className={`w-full h-14 rounded-2xl items-center justify-center ${
                    isAvailable && !isChecking && !isSubmitting
                      ? "bg-brand-forest active:opacity-90"
                      : "bg-brand-card border border-brand-divider opacity-50"
                  }`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#F7F6F3" />
                  ) : (
                    <Text className="text-sm font-outfitBold text-brand-charcoal uppercase tracking-wider">
                      Claim Handle & Continue
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
    </Modal>
  );
}
