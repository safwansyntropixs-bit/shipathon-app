import { Image } from "expo-image";
import React, { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";

interface UserAvatarProps {
  avatarUrl?: string | null;
  initials?: string;
  size?: number;
  className?: string;
  isLoading?: boolean;
}

// OPTIMIZATION 1: Extracted Loading Overlay to prevent JSX duplication
// Is se Virtual DOM ka size chota ho jayega aur memory footprint kam hoga.
const LoadingOverlay = React.memo(({ color = "#FFFFFF" }: { color?: string }) => (
  <View className="absolute inset-0 items-center justify-center bg-black/60 z-20">
    <ActivityIndicator size="small" color={color} />
  </View>
));

// OPTIMIZATION 2: React.memo on Main Component
// Agar user app mein kahin aur navigate karta hai ya data sync hota hai, toh Avatar faltu mein re-render nahi hoga.
export const UserAvatar = React.memo(({
  avatarUrl,
  initials = "U",
  size = 40,
  className = "",
  isLoading = false,
}: UserAvatarProps) => {

  // OPTIMIZATION 3: Memoizing String Operations
  // Ab regex/string checks sirf tabhi challenge jab sach mein avatarUrl change hoga, warna JS purana result use karega.
  const { isUrl, isEmoji } = useMemo(() => {
    const checkUrl = avatarUrl?.startsWith("http") || avatarUrl?.startsWith("data:");
    const checkEmoji = !checkUrl && avatarUrl && avatarUrl.length > 0 && avatarUrl.length <= 10;
    return { isUrl: checkUrl, isEmoji: checkEmoji };
  }, [avatarUrl]);

  // OPTIMIZATION 4: Memoizing Dynamic Styles
  // Naya style object baar baar memory mein allocate nahi hoga, Garbage Collector par load zero.
  const defaultStyles = useMemo(() => {
    return { width: size, height: size, borderRadius: size / 2 };
  }, [size]);

  const textStyle = useMemo(() => {
    return { fontSize: size * 0.5 };
  }, [size]);

  const initialsStyle = useMemo(() => {
    return { fontSize: size * 0.4 };
  }, [size]);

  // OPTIMIZATION 5: Static objects mapped safely
  const imageStyle = useMemo(() => ({ width: "100%", height: "100%" }), []);

  if (isUrl) {
    return (
      <View className={`overflow-hidden items-center justify-center bg-brand-forest ${className}`} style={defaultStyles}>

        <Image
          source={{ uri: avatarUrl as string }}
          style={{ width: "100%", height: "100%", zIndex: 10 }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk" // Ensure cache is aggressively used
        />
        {isLoading && <LoadingOverlay color="#FFFFFF" />}
      </View>
    );
  }

  if (isEmoji) {
    return (
      <View className={`items-center justify-center bg-brand-card overflow-hidden ${className}`} style={defaultStyles}>
        {isLoading && <LoadingOverlay color="#FFFFFF" />}
        <Text className="text-xl" style={textStyle}>
          {avatarUrl}
        </Text>
      </View>
    );
  }

  return (
    <View className={`items-center justify-center bg-brand-forest overflow-hidden ${className}`} style={defaultStyles}>
      {isLoading && <LoadingOverlay color="#FFFFFF" />}
      <Text
        className="font-outfitBold text-white"
        style={initialsStyle}
      >
        {initials}
      </Text>
    </View>
  );
});