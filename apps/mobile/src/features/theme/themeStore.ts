/**
 * Visual Theme Zustand Store
 * Hawem (حايم) Citizen-Science Platform
 *
 * Supports Day (Porcelain Light) and Night (Obsidian Dark) visual modes.
 * Persists user preference via AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'day' | 'night';

export interface ThemeColors {
  isNight: boolean;
  backgroundGradient: readonly [string, string, string];
  screenBg: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  statusBarStyle: 'dark' | 'light';
  pillBg: string;
}

export const DAY_THEME: ThemeColors = {
  isNight: false,
  backgroundGradient: ['#FDF2EC', '#FAF5EE', '#F3F6F2'] as const,
  screenBg: '#F7F6F2',
  cardBg: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  statusBarStyle: 'dark',
  pillBg: '#F1F5F9',
};

export const NIGHT_THEME: ThemeColors = {
  isNight: true,
  backgroundGradient: ['#0B1120', '#0F172A', '#1E293B'] as const,
  screenBg: '#0B1120',
  cardBg: '#1E293B',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#334155',
  statusBarStyle: 'light',
  pillBg: '#1E293B',
};

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
