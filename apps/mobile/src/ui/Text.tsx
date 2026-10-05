import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from './theme';

type Variant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption';
type Tone = 'ink' | 'ink2' | 'ink3' | 'accent' | 'danger' | 'warning' | 'onAccent' | 'cat' | 'dog';

export interface HTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: '400' | '600' | '700';
  /** Tabular figures for numbers that change or are compared */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
}

const TRACKING: Partial<Record<Variant, number>> = {
  largeTitle: 0.37,
  title1: 0.36,
  title2: 0.35,
  title3: 0.38,
  headline: -0.41,
  body: -0.41,
  callout: -0.32,
  subhead: -0.24,
  footnote: -0.08,
};

export function Text({
  variant = 'body',
  tone = 'ink',
  weight,
  tabular,
  align,
  style,
  ...rest
}: HTextProps) {
  const { c, type } = useTheme();
  const t = type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        {
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          fontWeight: weight ?? t.fontWeight,
          letterSpacing: TRACKING[variant] ?? 0,
          color: c[tone],
          textAlign: align,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}
