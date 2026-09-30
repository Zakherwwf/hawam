import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  hawemDark,
  hawemLight,
  hawemRadius,
  hawemSpace,
  hawemType,
  type HawemColors,
} from '@tunisia-survey/design-tokens';
import { useThemeStore } from '../features/theme/themeStore';

export interface HawemTheme {
  c: HawemColors;
  dark: boolean;
  type: typeof hawemType;
  space: typeof hawemSpace;
  radius: typeof hawemRadius;
}

/** Design system v3 (docs/DESIGN.md), following the app's day/night setting. */
export function useTheme(): HawemTheme {
  const dark = useThemeStore((s) => s.themeMode === 'night');
  return {
    c: dark ? hawemDark : hawemLight,
    dark,
    type: hawemType,
    space: hawemSpace,
    radius: hawemRadius,
  };
}

/** True when the system asks for reduced motion; animations then snap. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
