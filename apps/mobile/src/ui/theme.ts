import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  hawemGradients,
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
  g: (typeof hawemGradients)['light'] | (typeof hawemGradients)['dark'];
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
    g: dark ? hawemGradients.dark : hawemGradients.light,
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

/**
 * The one card shadow: a faint, wide shadow in light mode that lifts white
 * cards off the grey canvas without a border. Dark mode relies on the
 * lighter surface colour instead.
 */
export function useCardShadow() {
  const { dark } = useTheme();
  if (dark) return {};
  return {
    shadowColor: '#1D1D1F',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  } as const;
}
