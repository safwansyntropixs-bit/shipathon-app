import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type ModalBorderTheme = 'emerald' | 'gold' | 'red';

export interface ModalTopBorderProps {
  /**
   * Theme variant for the border and glow.
   * - 'emerald': Brand green luminous beam (Default)
   * - 'gold': Pro/Premium golden luminous beam
   * - 'red': Destructive/Confirmation alert luminous beam
   */
  theme?: ModalBorderTheme;
  /**
   * Height of the top luminous beam. Defaults to 0.5px.
   */
  height?: number;
  /**
   * Whether to display the soft ambient inner glow descending from the top. Defaults to true.
   */
  showGlow?: boolean;
  /**
   * Custom beam gradient colors if overriding theme presets.
   */
  beamColors?: readonly [string, string, ...string[]];
  /**
   * Custom inner glow gradient colors if overriding theme presets.
   */
  glowColors?: readonly [string, string, ...string[]];
  /**
   * Optional custom style for the top beam.
   */
  beamStyle?: StyleProp<ViewStyle>;
  /**
   * Optional custom style for the inner glow.
   */
  glowStyle?: StyleProp<ViewStyle>;
}

const THEME_BEAM_COLORS: Record<ModalBorderTheme, [string, string, ...string[]]> = {
  emerald: [
    'transparent',
    'rgba(58, 158, 102, 0.3)',
    'rgba(74, 222, 128, 0.75)',
    'rgba(58, 158, 102, 0.3)',
    'transparent',
  ],
  gold: [
    'transparent',
    'rgba(240, 179, 92, 0.35)',
    'rgba(253, 224, 71, 0.85)',
    'rgba(240, 179, 92, 0.35)',
    'transparent',
  ],
  red: [
    'transparent',
    'rgba(239, 68, 68, 0.35)',
    'rgba(248, 113, 113, 0.85)',
    'rgba(239, 68, 68, 0.35)',
    'transparent',
  ],
};

const THEME_GLOW_COLORS: Record<ModalBorderTheme, [string, string, ...string[]]> = {
  emerald: [
    'rgba(58, 158, 102, 0.12)',
    'rgba(58, 158, 102, 0.02)',
    'transparent',
  ],
  gold: [
    'rgba(240, 179, 92, 0.14)',
    'rgba(240, 179, 92, 0.02)',
    'transparent',
  ],
  red: [
    'rgba(239, 68, 68, 0.14)',
    'rgba(239, 68, 68, 0.02)',
    'transparent',
  ],
};

/**
 * Reusable Luminous Top Border Beam & Ambient Glow for Bottom Sheets and Modals.
 * Eliminates harsh borders and drag indicators in favor of a sleek, modern visual aesthetic.
 */
export const ModalTopBorder: React.FC<ModalTopBorderProps> = ({
  theme = 'emerald',
  height = 0.5,
  showGlow = true,
  beamColors,
  glowColors,
  beamStyle,
  glowStyle,
}) => {
  const activeBeamColors = (beamColors || THEME_BEAM_COLORS[theme]) as [string, string, ...string[]];
  const activeGlowColors = (glowColors || THEME_GLOW_COLORS[theme]) as [string, string, ...string[]];

  return (
    <>
      {/* Top Luminous Light Beam */}
      <LinearGradient
        colors={activeBeamColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          {
            height,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          },
          beamStyle,
        ]}
        pointerEvents="none"
      />

      {/* Ambient Inner Glow */}
      {showGlow && (
        <LinearGradient
          colors={activeGlowColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.45 }}
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
            },
            glowStyle,
          ]}
          pointerEvents="none"
        />
      )}
    </>
  );
};
