import { Eye, EyeOff } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface FloatingLabelInputProps extends TextInputProps {
  label: string;
  icon?: React.ReactNode;
  containerStyle?: string;
  isPassword?: boolean;
}

export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  icon,
  containerStyle = "mb-3",
  value,
  isPassword,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const animatedValue = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    if (isFocused || value) {
      animatedValue.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    } else {
      animatedValue.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
    }
  }, [isFocused, value]);

  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      top: interpolate(animatedValue.value, [0, 1], [12, 2], Extrapolation.CLAMP),
      fontSize: interpolate(animatedValue.value, [0, 1], [13, 10], Extrapolation.CLAMP),
    };
  });

  return (
    <View className={`border ${isFocused ? 'border-[#3A9E66] bg-[#3A9E66]/[0.06]' : 'border-white/10 bg-white/[0.03]'} rounded-2xl px-3.5 py-1 flex-row items-center ${containerStyle}`}>
      {icon && (
        <View className="w-8 h-8 items-center justify-center">
          {icon}
        </View>
      )}
      <View className="flex-1 ml-2 justify-center relative h-12 items-center">
        <Animated.Text
          className={`absolute left-0 font-outfitMed uppercase tracking-wide z-20 ${isFocused ? 'text-[#4ADE80]' : 'text-zinc-400'}`}
          style={animatedLabelStyle}
          pointerEvents="none"
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
        <TextInput
          className="font-outfitMed text-white text-sm p-0 m-0 w-full h-full pt-4 z-10"
          value={value}
          onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
          secureTextEntry={isPassword && !showPassword}
          placeholder=""
          selectionColor="#3A9E66"
          {...props}
        />
      </View>
      {isPassword && (
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          className="w-8 h-8 items-center justify-center"
        >
          {showPassword ? (
            <EyeOff size={18} color="#3A9E66" />
          ) : (
            <Eye size={18} color="#A1A1AA" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};
