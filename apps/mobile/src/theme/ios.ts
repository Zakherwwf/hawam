import { StyleSheet, Platform } from 'react-native';

/**
 * Apple Design System (iOS Human Interface Guidelines) Tokens.
 * https://developer.apple.com/design/resources/
 */

export const IOSColors = {
  // System Backgrounds (Soft warm porcelain canvas from Reference 1 & 3)
  systemBackground: '#F7F6F2',
  secondarySystemBackground: '#FFFFFF',
  tertiarySystemBackground: '#F1F5F9',
  systemGroupedBackground: '#F7F6F2',
  secondarySystemGroupedBackground: '#FFFFFF',

  // Reference 1 & 3 Signature Brand Gradients
  sunsetGradient: ['#DD4B34', '#ED6C44', '#FBA567'] as const,
  sunsetSoftGradient: ['#E25841', '#EE7B53', '#FDBA78'] as const,
  citronGlowGradient: ['#D9F944', '#B6EA22'] as const,
  obsidianGradient: ['#18181B', '#0F172A'] as const,

  // Reference 1 (OxeliaMetrix) Electric Citron & Accents
  citron: '#D9F944',
  citronLight: '#F5FDCE',
  citronDark: '#8DAE0A',

  // Reference 3 (Willie Schulist) Warm Terracotta & Peach
  terracotta: '#DD4B34',
  terracottaLight: '#FFEDE8',
  coral: '#ED6C44',
  coralLight: '#FFF1EC',
  amberWarm: '#FBA567',
  amberLight: '#FEF3C7',

  // Reference 2 (TripGlide) Obsidian
  obsidian: '#111827',
  obsidianPill: '#18181B',

  // Labels & Text
  label: '#0F172A',
  secondaryLabel: '#64748B',
  tertiaryLabel: '#94A3B8',
  quaternaryLabel: '#CBD5E1',

  // Separators & Fills
  separator: '#E2E8F0',
  opaqueSeparator: '#CBD5E1',
  systemFill: 'rgba(15, 23, 42, 0.06)',
  secondarySystemFill: 'rgba(15, 23, 42, 0.04)',
  tertiarySystemFill: 'rgba(15, 23, 42, 0.02)',
  quaternarySystemFill: 'rgba(15, 23, 42, 0.01)',

  // Semantic Tints
  systemBlue: '#2563EB',
  systemTeal: '#0F172A',
  systemGreen: '#10B981',
  systemIndigo: '#6366F1',
  systemOrange: '#ED6C44',
  systemPink: '#EC4899',
  systemPurple: '#8B5CF6',
  systemRed: '#EF4444',
  systemYellow: '#F59E0B',

  // System Grays
  systemGray: '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F1F5F9',
};

export const IOSTypography = StyleSheet.create({
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: 0.37,
    color: IOSColors.label,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: 0.36,
    color: IOSColors.label,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 0.35,
    color: IOSColors.label,
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: 0.38,
    color: IOSColors.label,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.41,
    color: IOSColors.label,
  },
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.41,
    color: IOSColors.label,
  },
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: -0.32,
    color: IOSColors.label,
  },
  subheadline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.24,
    color: IOSColors.secondaryLabel,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.08,
    color: IOSColors.secondaryLabel,
  },
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0,
    color: IOSColors.secondaryLabel,
  },
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    letterSpacing: 0.07,
    color: IOSColors.secondaryLabel,
  },
});

export const IOSLayout = {
  insetMargin: 16,
  cardRadius: 14,
  buttonRadius: 12,
  controlRadius: 9,
  hairline: StyleSheet.hairlineWidth,
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: IOSColors.systemGray4,
    alignSelf: 'center' as const,
    marginTop: 8,
    marginBottom: 12,
  },
};
