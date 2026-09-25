import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ModalBorderTheme, ModalTopBorder } from '../ui/ModalTopBorder';

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  theme?: ModalBorderTheme;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = false,
  theme,
  isLoading = false
}) => {
  const borderTheme: ModalBorderTheme = theme || (isDestructive ? 'red' : 'emerald');

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable 
        className="flex-1 bg-black/60 items-center justify-center p-6"
        onPress={onCancel}
      >
        <Pressable 
          className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl p-6 border border-white/5 shadow-2xl overflow-hidden relative"
          onPress={(e) => e.stopPropagation()}
        >
          <ModalTopBorder theme={borderTheme} />
          <Text className="text-xl font-outfitBold text-white mb-2 text-center tracking-tight z-10">
            {title}
          </Text>
          <Text className="text-[13px] font-outfitReg text-brand-grey mb-8 text-center leading-relaxed">
            {description}
          </Text>

          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={onCancel}
              className="flex-1 h-12 bg-white/5 rounded-xl items-center justify-center border border-white/10 active:bg-white/10"
            >
              <Text className="text-white font-outfitMed text-[13px]">
                {cancelText}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={onConfirm}
              disabled={isLoading}
              className={`flex-1 h-12 rounded-xl items-center justify-center active:opacity-80 ${isDestructive ? 'bg-red-500/20 border border-red-500/30' : 'bg-brand-forest border border-brand-forest/80'}`}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={isDestructive ? "#F87171" : "#FFFFFF"} />
              ) : (
                <Text className={`${isDestructive ? 'text-red-400' : 'text-white'} font-outfitBold text-[13px]`}>
                  {confirmText}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
