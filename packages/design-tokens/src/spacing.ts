export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const touchTargets = {
  minimum: 44,
  min: 44,
  primaryFieldAction: 64,
  hero: 64,
} as const;

export const brand = {
  porcelainBg: '#F8F9FA',
  sunsetGradient: ['#F97316', '#EC4899', '#8B5CF6'] as const,
  nightGradient: ['#0A0F1D', '#1E1B4B'] as const,
} as const;
