import { ProVisibilityGate } from "@/components/ui/ProVisibilityGate";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { LayoutRectangle, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

export interface SegmentedControlOption {
  label: string;
  value: string;
  fontSize?: number;
  isLocked?: boolean;
  badge?: boolean | number;
  [key: string]: any;
}

export interface AnimatedSegmentedControlProps {
  options: SegmentedControlOption[];
  activeOption: string;
  onOptionPress: (value: string) => void;
  containerClassName?: string;
  itemFlex?: boolean;
  itemPaddingHorizontal?: number;
  itemPaddingVertical?: number;
  initialLayouts?: Record<string, LayoutRectangle>;
}

export const AnimatedSegmentedControl: React.FC<AnimatedSegmentedControlProps> = ({
  options,
  activeOption,
  onOptionPress,
  containerClassName = "flex-row bg-brand-bgSand p-1 rounded-xl",
  itemFlex = true,
  itemPaddingHorizontal = 0,
  itemPaddingVertical = 8,
  initialLayouts = {},
}) => {
  const [internalActiveOption, setInternalActiveOption] = useState(activeOption);

  useEffect(() => {
    setInternalActiveOption(activeOption);
  }, [activeOption]);

  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>(initialLayouts);
  const activeLayout = layouts[internalActiveOption];

  const animatedStyle = useAnimatedStyle(() => {
    if (!activeLayout || !activeLayout.width) return { opacity: 0 };
    return {
      opacity: 1,
      transform: [{ translateX: withSpring(activeLayout.x, { damping: 45, stiffness: 300 }) }],
      width: withSpring(activeLayout.width, { damping: 25, stiffness: 120 }),
    };
  }, [activeLayout]);

  const handlePress = (opt: SegmentedControlOption) => {
    if (opt.isLocked) {
      // Tactile feedback strictly on locked feature interaction
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onOptionPress(opt.value);
    } else if (internalActiveOption !== opt.value) {
      setInternalActiveOption(opt.value);
      onOptionPress(opt.value);
    }
  };

  return (
    <View className={`relative flex-row ${containerClassName}`}>
      {Boolean(activeLayout && activeLayout.width > 0) && (
        <Animated.View
          className="absolute top-1 bottom-1 bg-brand-forest rounded-lg left-0"
          style={animatedStyle}
        />
      )}
      {options.map((opt) => {
        const isActive = internalActiveOption === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.7}
            onLayout={(e) => {
              const layout = e.nativeEvent.layout;
              if (layout.width > 0) {
                setLayouts((prev) => ({ ...prev, [opt.value]: layout }));
              }
            }}
            onPress={() => handlePress(opt)}
            className={`items-center justify-center flex-row z-10 rounded-lg ${
              itemFlex ? "flex-1" : ""
            }`}
            style={{
              paddingHorizontal: itemPaddingHorizontal,
              paddingVertical: itemPaddingVertical,
            }}
          >
            <Text
              className={`font-outfitBold uppercase tracking-wider ${
                isActive ? "text-brand-charcoal" : "text-brand-grey"
              }`}
              style={{
                fontSize: opt.fontSize || 12,
              }}
            >
              {opt.label}
            </Text>
            {Boolean(opt.isLocked) && (
              <View className="ml-1">
                <ProVisibilityGate
                  lockIconSize={10}
                  lockIconColor="#F0B35C"
                />
              </View>
            )}
            {Boolean(opt.badge) && (
              <View className="ml-1.5 w-2 h-2 rounded-full bg-[#E5484D]" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
