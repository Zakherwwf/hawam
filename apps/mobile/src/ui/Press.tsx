import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from './theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with the system-wide press feedback: scale 0.97 and a light haptic. */
export function Press({
  style,
  children,
  haptic = true,
  onPress,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  haptic?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const to = (v: number) =>
    reduced
      ? scale.setValue(1)
      : Animated.spring(scale, {
          toValue: v,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }).start();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(e) => {
        to(0.97);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
