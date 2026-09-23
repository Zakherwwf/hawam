import { StyleSheet, Platform } from 'react-native';

/**
 * Apple Design System (iOS Human Interface Guidelines) Tokens.
 * https://developer.apple.com/design/resources/
 */

export const IOSColors = {
  // System Backgrounds (Light mode defaults)
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7', // Inset grouped table background
  tertiarySystemBackground: '#FFFFFF',
  systemGroupedBackground: '#F2F2F7',
  secondarySystemGroupedBackground: '#FFFFFF',

  // Labels & Text
  label: '#000000',
  secondaryLabel: 'rgba(60, 60, 67, 0.60)', // ~#8E8E93
  tertiaryLabel: 'rgba(60, 60, 67, 0.30)',
  quaternaryLabel: 'rgba(60, 60, 67, 0.18)',

  // Separators & Fills
  separator: 'rgba(60, 60, 67, 0.20)', // Hairline divider
  opaqueSeparator: '#C6C6C8',
  systemFill: 'rgba(120, 120, 128, 0.20)',
  secondarySystemFill: 'rgba(120, 120, 128, 0.16)',
  tertiarySystemFill: 'rgba(118, 118, 128, 0.12)',
  quaternarySystemFill: 'rgba(116, 116, 128, 0.08)',

  // iOS System Tints
  systemBlue: '#007AFF',
  systemTeal: '#30B0C7', // Tunisia citizen-science primary brand
  systemGreen: '#34C759',
  systemIndigo: '#5856D6',
  systemOrange: '#FF9500',
  systemPink: '#FF2D55',
  systemPurple: '#AF52DE',
  systemRed: '#FF3B30',
  systemYellow: '#FFCC00',

  // System Grays
  systemGray: '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F2F2F7',
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
