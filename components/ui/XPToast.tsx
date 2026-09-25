import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Flame, Target, Timer, Zap, Activity, Award, Shield, Swords, Crown } from 'lucide-react-native';

const ICONS: Record<string, any> = {
  Flame, Target, Timer, Zap, Activity, Award, Shield, Swords, Crown
};

export type XPToastTheme = 'default' | 'warning' | 'trophy';

interface XPToastProps {
  title: string;
  subtitle: string;
  xpAmount: number;
  iconName?: string;
  theme?: XPToastTheme;
  imageSource?: any;
  accentColor?: string;
  index: number;
  onComplete: () => void;
}

export function XPToast({ title, subtitle, xpAmount, iconName, theme = 'default', imageSource, accentColor, index, onComplete }: XPToastProps) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Slide down and fade in (with staggering if there are multiple)
    translateY.value = withSpring(index * 70, { damping: 14, stiffness: 100 });
    opacity.value = withTiming(1, { duration: 300 });

    // Wait 4 seconds, then slide up and fade out
    const timeoutId = setTimeout(() => {
      translateY.value = withTiming(-100, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 }, (finished) => {
        if (finished && onCompleteRef.current) {
          runOnJS(onCompleteRef.current)();
        }
      });
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [index, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  const IconComponent = iconName ? ICONS[iconName] : Award;
  const isWarning = theme === 'warning';
  const isTrophy = theme === 'trophy';

  return (
    <Animated.View 
      style={[
        { position: 'absolute', top: 56, right: 16, zIndex: 99999, elevation: 99999 },
        animatedStyle
      ]}
      pointerEvents="none"
    >
      <View 
        className={`flex-row items-center bg-[#1E1E1E]/95 border rounded-full px-4 py-3 shadow-2xl ${!isTrophy ? (isWarning ? 'border-orange-500/30' : 'border-white/10') : ''}`}
        style={isTrophy ? { borderColor: accentColor ? `${accentColor}40` : '#FACC1540' } : {}}
      >
        <View 
          className={`rounded-full mr-3 border items-center justify-center overflow-hidden ${imageSource ? 'w-10 h-10' : 'p-2'} ${!isTrophy ? (isWarning ? 'bg-orange-500/20 border-orange-500/50' : 'bg-brand-forest/20 border-brand-forest/30') : ''}`}
          style={isTrophy ? { backgroundColor: accentColor ? `${accentColor}20` : '#FACC1520', borderColor: accentColor ? `${accentColor}50` : '#FACC1550' } : {}}
        >
          {imageSource ? (
            <Image source={imageSource} style={{ width: 35, height: 35, resizeMode: 'contain' }} fadeDuration={0} />
          ) : (
            <IconComponent size={20} color={isTrophy ? (accentColor || "#FACC15") : isWarning ? "#F97316" : "#A7C4B5"} />
          )}
        </View>
        <View className="mr-3">
          <Text 
            className={`text-[10px] font-outfitMed uppercase tracking-widest mb-0.5 ${!isTrophy ? (isWarning ? 'text-orange-200' : 'text-brand-sage') : ''}`}
            style={isTrophy ? { color: accentColor ? `${accentColor}CC` : '#FEF08A' } : {}}
          >
            {subtitle}
          </Text>
          <Text 
            className={`text-sm font-outfitBold flex-shrink ${isTrophy ? 'text-white shadow-sm' : 'text-white'}`} 
            numberOfLines={1}
            style={isTrophy ? { textShadowColor: accentColor ? `${accentColor}80` : '#FACC1580', textShadowRadius: 10 } : {}}
          >
            {title}
          </Text>
        </View>
        <View 
          className={`px-2 py-1 rounded-md border ${!isTrophy ? (isWarning ? 'bg-orange-500/30 border-orange-500/50' : 'bg-[#2F6B47]/30 border-[#3E8B5C]/50') : ''}`}
          style={isTrophy ? { backgroundColor: accentColor ? `${accentColor}30` : '#FACC1530', borderColor: accentColor ? `${accentColor}50` : '#FACC1550' } : {}}
        >
          <Text 
            className={`font-outfitBold text-xs ${!isTrophy ? (isWarning ? 'text-orange-300' : 'text-brand-success') : ''}`}
            style={isTrophy ? { color: accentColor || '#FDE047' } : {}}
          >
            +{xpAmount} XP
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
