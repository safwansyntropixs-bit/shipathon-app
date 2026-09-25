import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
} from 'react-native';
import { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { CheckCircle2, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export type ToastThemeType = 'success' | 'error';

interface ToastThemeConfig {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  iconColor: string;
  iconBg: string;
  iconBorder: string;
  glowColor: string;
  accentBorder: string;
}

const THEMES: Record<ToastThemeType, ToastThemeConfig> = {
  success: {
    icon: CheckCircle2,
    iconColor: '#4ADE80',
    iconBg: 'rgba(58, 158, 102, 0.22)',
    iconBorder: 'rgba(74, 222, 128, 0.38)',
    glowColor: 'rgba(58, 158, 102, 0.18)',
    accentBorder: 'rgba(74, 222, 128, 0.22)',
  },
  error: {
    icon: AlertCircle,
    iconColor: '#F87171',
    iconBg: 'rgba(239, 68, 68, 0.22)',
    iconBorder: 'rgba(248, 113, 113, 0.38)',
    glowColor: 'rgba(239, 68, 68, 0.18)',
    accentBorder: 'rgba(248, 113, 113, 0.22)',
  },
};

interface DynamicIslandToastProps extends ToastConfigParams<any> {
  themeType: ToastThemeType;
}

function DynamicIslandToast({
  text1,
  text2,
  hide,
  onPress,
  isVisible,
  themeType,
}: DynamicIslandToastProps) {
  const theme = THEMES[themeType] || THEMES.success;
  const IconComponent = theme.icon;

  const translateX = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef(false);

  useEffect(() => {
    if (isVisible) {
      translateX.setValue(0);
      isDismissing.current = false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [isVisible, text1, text2, translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (!isDismissing.current) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isDismissing.current) return;

        const SWIPE_THRESHOLD = 30;
        const SWIPE_VELOCITY = 0.2;

        if (
          Math.abs(gestureState.dx) > SWIPE_THRESHOLD ||
          Math.abs(gestureState.vx) > SWIPE_VELOCITY
        ) {
          isDismissing.current = true;
          const direction = gestureState.dx >= 0 ? 1 : -1;
          Animated.timing(translateX, {
            toValue: direction * 500,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            hide();
          });
        } else if (
          Math.abs(gestureState.dx) < 6 &&
          Math.abs(gestureState.dy) < 6
        ) {
          // Tap event
          if (onPress) {
            onPress();
          } else {
            hide();
          }
        } else {
          // Spring back to center
          Animated.spring(translateX, {
            toValue: 0,
            bounciness: 6,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isDismissing.current) return;
        Animated.spring(translateX, {
          toValue: 0,
          bounciness: 6,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const opacity = translateX.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.touchWrapper}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.islandCard,
          {
            borderColor: theme.accentBorder,
            transform: [{ translateX }],
            opacity,
          },
        ]}
      >
        {/* Ambient Subtle Glow */}
        <View
          style={[styles.glowLayer, { backgroundColor: theme.glowColor }]}
          pointerEvents="none"
        />

        {/* Left Status Capsule / Island Feature */}
        <View
          style={[
            styles.iconCapsule,
            {
              backgroundColor: theme.iconBg,
              borderColor: theme.iconBorder,
            },
          ]}
          pointerEvents="none"
        >
          <IconComponent size={18} color={theme.iconColor} strokeWidth={2.4} />
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer} pointerEvents="none">
          {text1 ? (
            <Text style={styles.titleText} numberOfLines={1}>
              {text1}
            </Text>
          ) : null}
          {text2 ? (
            <Text style={styles.subtitleText} numberOfLines={2}>
              {text2}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: (params) => <DynamicIslandToast {...params} themeType="success" />,
  error: (params) => <DynamicIslandToast {...params} themeType="error" />,
};

const styles = StyleSheet.create({
  touchWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  islandCard: {
    width: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C0C0E',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  glowLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.8,
  },
  iconCapsule: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 4,
    justifyContent: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontFamily: 'OutfitBold',
    fontSize: 13,
    letterSpacing: 0.2,
    lineHeight: 17,
  },
  subtitleText: {
    color: '#A1A1AA',
    fontFamily: 'OutfitRegular',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
});
