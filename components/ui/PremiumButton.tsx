import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';

export type PremiumButtonVariant = 'green' | 'gold';

export interface PremiumButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: PremiumButtonVariant;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  gradientColors?: readonly [string, string, ...string[]];
  textStyle?: TextStyle;
  containerStyle?: ViewStyle;
}

const GRADIENTS: Record<PremiumButtonVariant, [string, string, ...string[]]> = {
  green: ["#4ade80", "#166534"],
  gold: ["#FDE047", "#F0B35C", "#D97706"],
};

const SHADOW_CLASSES: Record<PremiumButtonVariant, string> = {
  green: "shadow-[#10B981]/25",
  gold: "shadow-[#F0B35C]/25",
};

const TEXT_COLORS: Record<PremiumButtonVariant, string> = {
  green: "text-[#022c15]",
  gold: "text-[#291400]",
};

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  title,
  loading = false,
  disabled = false,
  size = 'md',
  variant = 'green',
  icon,
  iconPosition = 'left',
  gradientColors,
  textStyle,
  containerStyle,
  className = "",
  onPress,
  ...props
}) => {
  const getHeightClass = () => {
    if (size === 'sm') return 'h-10';
    if (size === 'lg') return 'h-14';
    return 'h-12';
  };

  const getTextSizeClass = () => {
    if (size === 'sm') return 'text-xs';
    if (size === 'lg') return 'text-base';
    return 'text-[14px]';
  };

  const activeGradient = (gradientColors || GRADIENTS[variant]) as [string, string, ...string[]];
  const shadowClass = SHADOW_CLASSES[variant];
  const textColorClass = TEXT_COLORS[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      className={`w-full ${getHeightClass()} rounded-full overflow-hidden shadow-lg ${shadowClass} ${(disabled || loading) ? 'opacity-50' : 'active:opacity-90'
        } ${className}`}
      style={containerStyle}
      {...props}
    >
      <LinearGradient
        colors={activeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="flex-1 flex-row items-center justify-center px-4 gap-2"
      >
        {loading ? (
          <ActivityIndicator color={variant === 'gold' ? '#291400' : 'white'} />
        ) : (
          <>
            {icon && iconPosition === 'left' && icon}
            <Text
              className={`${getTextSizeClass()} font-outfitBold ${textColorClass} tracking-wide text-center`}
              style={textStyle}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && icon}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};
