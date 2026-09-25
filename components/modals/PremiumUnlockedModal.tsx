import { usePremiumStore } from "@/store/core/premiumStore";
import { useProfileStore } from "@/store/user/profileStore";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ModalTopBorder } from "../ui/ModalTopBorder";
import { PremiumButton } from "../ui/PremiumButton";

export const PremiumUnlockedModal: React.FC = () => {
  const hasJustSubscribed = usePremiumStore((s) => s.hasJustSubscribed);
  const setJustSubscribed = usePremiumStore((s) => s.setJustSubscribed);

  useEffect(() => {
    if (hasJustSubscribed) {
      if (useProfileStore.getState().preferences.haptics) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      }
    }
  }, [hasJustSubscribed]);

  const handleClose = () => {
    setJustSubscribed(false);
  };

  if (!hasJustSubscribed) return null;

  return (
    <Modal
      visible={hasJustSubscribed}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black/80">
        {/* Touch backdrop to dismiss */}
        <Pressable className="flex-1" onPress={handleClose} />

        {/* Modal Sheet without harsh borders */}
        <View className="bg-[#141417] rounded-t-[36px] overflow-hidden relative px-7 pt-8 pb-12 shadow-2xl">
          <ModalTopBorder theme="gold" />
          <View className="items-center z-10">
            {/* Title */}
            <Text className="text-[28px] font-outfitBold text-white text-center tracking-tight mb-2">
              Welcome to Pro!
            </Text>

            {/* Description */}
            <Text className="text-[14px] font-outfitReg text-zinc-400 text-center leading-[22px] mb-6 px-1">
              Your subscription is active. Enjoy unrestricted access to deep performance analytics, full workout history, and global leaderboards.
            </Text>



            {/* CTA Action */}
            <PremiumButton
              onPress={handleClose}
              title="Get Started"
              variant="gold"
              size="lg"
              className="w-full rounded-2xl"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};
