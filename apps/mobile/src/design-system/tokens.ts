/**
 * Apple Human Interface Guidelines (HIG) & Liquid Glass Design Tokens
 * Hawem (حايم) Citizen-Science Platform
 */

export const DesignTokens = {
  colors: {
    // Semantic System Colors (Soft warm porcelain canvas from Reference 1 & 3)
    systemBackground: '#F7F6F2',
    secondarySystemBackground: '#FFFFFF',
    tertiarySystemBackground: '#F1F5F9',
    systemGroupedBackground: '#F7F6F2',
    secondarySystemGroupedBackground: '#FFFFFF',

    // Reference Gradients
    gradients: {
      sunsetMesh: ['#DD4B34', '#ED6C44', '#FBA567'] as const,
      sunsetMeshSoft: ['#E25841', '#EE7B53', '#FDBA78'] as const,
      citronGlow: ['#D9F944', '#B6EA22'] as const,
      obsidianCard: ['#18181B', '#0F172A'] as const,
    },

    // Reference 1: OxeliaMetrix Electric Citron
    citron: '#D9F944',
    citronLight: '#F5FDCE',
    citronDark: '#8DAE0A',

    // Reference 3: Willie Schulist Terracotta & Warm Sunset Coral
    terracotta: '#DD4B34',
    terracottaLight: '#FFEDE8',
    coral: '#ED6C44',
    coralLight: '#FFF1EC',
    amberWarm: '#FBA567',
    amberLight: '#FEF3C7',

    // Reference 2: Obsidian
    obsidian: '#111827',
    obsidianPill: '#18181B',

    // Text & Content Labels
    label: '#0F172A',
    secondaryLabel: '#64748B',
    tertiaryLabel: '#94A3B8',
    quaternaryLabel: '#CBD5E1',

    // Separators & Borders
    separator: '#E2E8F0',
    opaqueSeparator: '#CBD5E1',

    // Core Brand Tint
    tint: '#0F172A',
    tintLight: '#F1F5F9',
    tintDark: '#020617',

    // Species Semantic Accents
    cat: '#DD4B34',
    catLight: '#FFEDE8',
    dog: '#ED6C44',
    dogLight: '#FEF3C7',

    // Nature Accents
    emerald: '#10B981',
    emeraldLight: '#D1FAE5',

    // Status & Scientific Triage
    welfareAlert: '#DC2626',
    welfareAlertLight: '#FEE2E2',
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',

    // Glass & Card Materials
    glassSurface: 'rgba(255, 255, 255, 0.88)',
    glassBorder: 'rgba(226, 232, 240, 0.8)',
    darkGlassSurface: 'rgba(15, 23, 42, 0.90)',
    darkGlassBorder: 'rgba(51, 65, 85, 0.6)',
  },

  typography: {
    largeTitle: {
      fontSize: 34,
      lineHeight: 41,
      fontWeight: '700' as const,
      letterSpacing: 0.37,
    },
    title1: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700' as const,
      letterSpacing: 0.36,
    },
    title2: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700' as const,
      letterSpacing: 0.35,
    },
    title3: {
      fontSize: 20,
      lineHeight: 25,
      fontWeight: '600' as const,
      letterSpacing: 0.38,
    },
    headline: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '600' as const,
      letterSpacing: -0.41,
    },
    body: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '400' as const,
      letterSpacing: -0.41,
    },
    callout: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '400' as const,
      letterSpacing: -0.32,
    },
    subheadline: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '400' as const,
      letterSpacing: -0.24,
    },
    footnote: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400' as const,
      letterSpacing: -0.08,
    },
    caption1: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500' as const,
      letterSpacing: 0,
    },
    caption2: {
      fontSize: 11,
      lineHeight: 13,
      fontWeight: '600' as const,
      letterSpacing: 0.07,
    },
    // Apple Fitness Workout HUD tabular display
    workoutMetricLarge: {
      fontSize: 48,
      lineHeight: 52,
      fontWeight: '800' as const,
      fontVariant: ['tabular-nums' as const],
    },
    workoutMetricMedium: {
      fontSize: 28,
      lineHeight: 32,
      fontWeight: '700' as const,
      fontVariant: ['tabular-nums' as const],
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  radii: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  touchTarget: {
    minHeight: 44,
    minWidth: 44,
  },

  shadows: {
    subtle: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 3,
    },
    glass: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    },
  },
};
