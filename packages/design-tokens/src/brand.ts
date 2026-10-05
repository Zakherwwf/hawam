/**
 * Hawem brand palette: the single source of colour values for the mobile app.
 * apps/mobile re-exposes it as IOSColors (theme/ios.ts) and
 * DesignTokens.colors (design-system/tokens.ts); neither defines colours.
 *
 * Text colours are chosen for WCAG AA (>= 4.5:1) on every light surface below,
 * because the app is read outdoors in direct sunlight (test/brand.test.ts).
 */

export const brandGradients = {
  sunsetMesh: ['#DD4B34', '#ED6C44', '#FBA567'] as const,
  sunsetMeshSoft: ['#E25841', '#EE7B53', '#FDBA78'] as const,
  citronGlow: ['#D9F944', '#B6EA22'] as const,
  obsidianCard: ['#18181B', '#0F172A'] as const,
};

export const brandPalette = {
  // Surfaces (warm porcelain canvas)
  systemBackground: '#F7F6F2',
  secondarySystemBackground: '#FFFFFF',
  tertiarySystemBackground: '#F1F5F9',
  systemGroupedBackground: '#F7F6F2',
  secondarySystemGroupedBackground: '#FFFFFF',

  // Gradients (flat aliases kept for IOSColors callers)
  sunsetGradient: brandGradients.sunsetMesh,
  sunsetSoftGradient: brandGradients.sunsetMeshSoft,
  citronGlowGradient: brandGradients.citronGlow,
  obsidianGradient: brandGradients.obsidianCard,

  // Accents. Citron is for dark surfaces and fills only: 1.1:1 on porcelain.
  citron: '#D9F944',
  citronLight: '#F5FDCE',
  citronDark: '#8DAE0A',
  terracotta: '#DD4B34',
  terracottaLight: '#FFEDE8',
  coral: '#ED6C44',
  coralLight: '#FFF1EC',
  amberWarm: '#FBA567',
  amberLight: '#FEF3C7',
  obsidian: '#111827',
  obsidianPill: '#18181B',

  // Labels. secondary/tertiary were #64748B (4.40:1) and #94A3B8 (2.37:1).
  label: '#0F172A',
  secondaryLabel: '#556275',
  tertiaryLabel: '#626F82',
  quaternaryLabel: '#CBD5E1', // decorative / disabled only, never body text

  // Separators & fills
  separator: '#E2E8F0',
  opaqueSeparator: '#CBD5E1',
  systemFill: 'rgba(15, 23, 42, 0.06)',
  secondarySystemFill: 'rgba(15, 23, 42, 0.04)',
  tertiarySystemFill: 'rgba(15, 23, 42, 0.02)',
  quaternarySystemFill: 'rgba(15, 23, 42, 0.01)',

  // Semantic tints (icons, fills, borders)
  systemBlue: '#2563EB',
  systemTeal: '#0F172A',
  systemGreen: '#10B981',
  systemIndigo: '#6366F1',
  systemOrange: '#ED6C44',
  systemPink: '#EC4899',
  systemPurple: '#8B5CF6',
  systemRed: '#EF4444',
  systemYellow: '#F59E0B',

  // System grays
  systemGray: '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F1F5F9',

  // Brand tint
  tint: '#0F172A',
  tintLight: '#F1F5F9',
  tintDark: '#020617',

  // Species accents (map pins, chips)
  cat: '#DD4B34',
  catLight: '#FFEDE8',
  dog: '#ED6C44',
  dogLight: '#FEF3C7',

  // Nature & status
  emerald: '#10B981',
  emeraldLight: '#D1FAE5',
  welfareAlert: '#DC2626',
  welfareAlertLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  // Text-safe variants of the status tints (>= 4.5:1 on light surfaces)
  successText: '#047857',
  warningText: '#B45309',
  dangerText: '#B91C1C',

  // Glass materials
  glassSurface: 'rgba(255, 255, 255, 0.88)',
  glassBorder: 'rgba(226, 232, 240, 0.8)',
  darkGlassSurface: 'rgba(15, 23, 42, 0.90)',
  darkGlassBorder: 'rgba(51, 65, 85, 0.6)',
};

export interface AppTheme {
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

export const dayTheme: AppTheme = {
  isNight: false,
  backgroundGradient: ['#FDF2EC', '#FAF5EE', '#F3F6F2'] as const,
  screenBg: brandPalette.systemBackground,
  cardBg: '#FFFFFF',
  textPrimary: brandPalette.label,
  textSecondary: brandPalette.secondaryLabel,
  border: brandPalette.separator,
  statusBarStyle: 'dark',
  pillBg: '#F1F5F9',
};

export const nightTheme: AppTheme = {
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

/** Light surfaces text is placed on; used by the contrast tests. */
export const lightSurfaces = [
  brandPalette.systemBackground,
  brandPalette.secondarySystemBackground,
  brandPalette.tertiarySystemBackground,
];
