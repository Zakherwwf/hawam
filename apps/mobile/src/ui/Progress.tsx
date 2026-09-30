import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useReducedMotion, useTheme } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle as any) as any;

export function ProgressBar({
  value,
  color,
  height = 8,
  label,
}: {
  value: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const { c } = useTheme();
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: c.fill, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${v * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? c.accent,
        }}
      />
    </View>
  );
}

/** Circular progress; animates from 0 on mount unless reduced motion is on. */
export function ProgressRing({
  value,
  size = 132,
  stroke = 12,
  color,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const v = Math.max(0, Math.min(1, value || 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) anim.setValue(v);
    else Animated.timing(anim, { toValue: v, duration: 700, useNativeDriver: false }).start();
  }, [v, reduced, anim]);
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.fill}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset as unknown as number}
        />
      </Svg>
      {children}
    </View>
  );
}
