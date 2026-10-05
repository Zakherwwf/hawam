import { StyleSheet, Platform } from 'react-native';
import { brandPalette } from '@tunisia-survey/design-tokens';

/**
 * Apple Design System (iOS Human Interface Guidelines) Tokens.
 * https://developer.apple.com/design/resources/
 */

// Values live in packages/design-tokens (brandPalette); this is a view over them
export const IOSColors = brandPalette;

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
