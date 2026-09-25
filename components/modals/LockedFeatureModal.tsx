import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ModalTopBorder } from "../ui/ModalTopBorder";
import { PremiumButton } from "../ui/PremiumButton";

export interface LockedFeatureModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgradePress: () => void;
  title?: string;
  description?: string;
  buttonText?: string;
}

export const LockedFeatureModal: React.FC<LockedFeatureModalProps> = ({
  visible,
  onClose,
  onUpgradePress,
  title = "Unlock Replix Pro",
  description = "To get full access, please upgrade your plan.",
  buttonText = "Upgrade to Pro",
}) => {
  const handleUpgrade = () => {
    onClose();
    onUpgradePress();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/80">
        {/* Backdrop touch area to dismiss */}
        <Pressable className="flex-1" onPress={onClose} />

        {/* Bottom Card */}
        <View className="bg-[#141417] rounded-t-[36px] overflow-hidden px-8 pt-8 pb-12 shadow-2xl relative">
          <ModalTopBorder theme="gold" />

          {/* Title */}
          <Text className="text-[26px] font-outfitBold text-white text-center mb-2.5 tracking-tight z-10">
            {title}
          </Text>

          {/* Description */}
          <Text className="text-[13px] font-outfitReg text-brand-grey text-center leading-relaxed mb-8 px-3 z-10">
            {description}
          </Text>

          {/* Upgrade Action Button */}
          <PremiumButton
            title={buttonText}
            onPress={handleUpgrade}
            variant="gold"
            size="lg"
            className="w-full rounded-2xl z-10"
          />
        </View>
      </View>
    </Modal>
  );
};
