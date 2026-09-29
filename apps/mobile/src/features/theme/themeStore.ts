/**
 * Visual Theme Zustand Store
 * Hawem (حايم) Citizen-Science Platform
 *
 * Supports Day (Porcelain Light) and Night (Obsidian Dark) visual modes.
 * Persists user preference via AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayTheme, nightTheme, type AppTheme } from '@tunisia-survey/design-tokens';

export type ThemeMode = 'day' | 'night';

// Palettes live in packages/design-tokens
export type ThemeColors = AppTheme;
export const DAY_THEME: ThemeColors = dayTheme;
export const NIGHT_THEME: ThemeColors = nightTheme;

interface ThemeState {
  themeMode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const THEME_STORAGE_KEY = '@hawem_theme_mode';

export const useThemeStore = create<ThemeState>((set, get) => {
  // Load initial theme from AsyncStorage
  if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((val) => {
        if (val === 'night' || val === 'day') {
          set({
            themeMode: val,
            colors: val === 'night' ? NIGHT_THEME : DAY_THEME,
          });
        }
      })
      .catch(() => {});
  }

  return {
    themeMode: 'day',
    colors: DAY_THEME,
    toggleTheme: () => {
      const next = get().themeMode === 'day' ? 'night' : 'day';
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      }
      set({
        themeMode: next,
        colors: next === 'night' ? NIGHT_THEME : DAY_THEME,
      });
    },
    setTheme: (mode: ThemeMode) => {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
      }
      set({
        themeMode: mode,
        colors: mode === 'night' ? NIGHT_THEME : DAY_THEME,
      });
    },
  };
});
