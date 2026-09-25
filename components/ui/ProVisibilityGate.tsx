import { useProGuard } from "@/hooks/useProGuard";
import { Crown, Lock } from "lucide-react-native";
import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

export interface ProVisibilityGateProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  showLockIcon?: boolean;
  lockIconSize?: number;
  lockIconColor?: string;
  iconType?: "crown" | "lock";
  invert?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * Lightweight visibility gate for micro visual indicators (e.g. crown badges, lock icons).
 * When user is Free/Expired, renders VIP indicator / fallback without replacing the UI block.
 */
export const ProVisibilityGate: React.FC<ProVisibilityGateProps> = ({
  children,
  fallback,
  showLockIcon = true,
  lockIconSize = 8,
  lockIconColor = "#F0B35C",
  iconType = "crown",
  invert = false,
  style,
  className = "",
}) => {
  const { isPro } = useProGuard();
  const condition = invert ? !isPro : isPro;

  if (condition) {
    return children ? <>{children}</> : null;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  if (showLockIcon) {
    const IconComponent = iconType === "crown" ? Crown : Lock;
    return (
      <View
        style={style}
        className={`bg-[#18181B] border border-[#F0B35C]/50 rounded-full p-1 ${className}`}
      >
        <IconComponent size={lockIconSize} color={lockIconColor} />
      </View>
    );
  }

  return null;
};
