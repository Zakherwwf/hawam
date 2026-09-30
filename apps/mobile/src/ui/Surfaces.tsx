import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from './theme';

/** A vertical (or diagonal) gradient fill: heroes, medallions, icon tiles. */
export function Gradient({
  colors,
  style,
  children,
  diagonal,
}: {
  colors: readonly string[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  diagonal?: boolean;
}) {
  return (
    <LinearGradient
      colors={colors as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={diagonal ? { x: 1, y: 1 } : { x: 0, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

/**
 * Frosted glass (boards 1 and 3; iOS Liquid Glass): a blur of whatever is
 * behind, a translucent white wash and a bright hairline edge. Android gets a
 * translucent surface without the blur, which is cheaper and still reads as glass.
 */
export function Glass({
  children,
  style,
  intensity = 40,
  tone = 'light',
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** 'light' over photos and maps; 'onColor' over a gradient hero */
  tone?: 'light' | 'onColor';
}) {
  const { dark, radius } = useTheme();
  const wash =
    tone === 'onColor'
      ? 'rgba(255,255,255,0.16)'
      : dark
        ? 'rgba(30,34,30,0.62)'
        : 'rgba(255,255,255,0.68)';
  const edge =
    tone === 'onColor'
      ? 'rgba(255,255,255,0.35)'
      : dark
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(255,255,255,0.9)';
  return (
    <View
      style={[
        { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: edge },
        style,
      ]}
    >
      {Platform.OS === 'ios' || Platform.OS === 'web' ? (
        <BlurView
          intensity={intensity}
          tint={dark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor:
              Platform.OS === 'android' && tone !== 'onColor'
                ? dark
                  ? 'rgba(30,34,30,0.92)'
                  : 'rgba(255,255,255,0.92)'
                : wash,
          },
        ]}
      />
      {children}
    </View>
  );
}
