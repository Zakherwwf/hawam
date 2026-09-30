/**
 * Hawem design system v3 (docs/DESIGN.md). One action colour, flat surfaces,
 * SF type ladder. Every text colour passes WCAG AA on canvas and surface in
 * both schemes (test/hawem.test.ts).
 */

export interface HawemColors {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
  ink2: string;
  ink3: string;
  hairline: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  warning: string;
  cat: string;
  dog: string;
  /** Tinted backgrounds for the matching colour (destructive, warning, species) */
  dangerSoft: string;
  warningSoft: string;
  catSoft: string;
  dogSoft: string;
  /** Neutral control fill (segmented controls, empty progress tracks) */
  fill: string;
  /** Badge medallion tiers (data, like species colours) */
  bronze: string;
  silver: string;
  gold: string;
}

export const hawemLight: HawemColors = {
  canvas: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  ink: '#1D1D1F',
  ink2: '#56565C',
  ink3: '#6E6E73',
  hairline: 'rgba(0, 0, 0, 0.08)',
  accent: '#0B6E4F',
  accentSoft: '#E4F2EC',
  onAccent: '#FFFFFF',
  danger: '#C62828',
  warning: '#8A5A00',
  cat: '#3F5BD8',
  dog: '#C2410C',
  dangerSoft: '#FDECEC',
  warningSoft: '#FBF1DD',
  catSoft: '#E8ECFB',
  dogSoft: '#FDF1EA',
  fill: 'rgba(118, 118, 128, 0.12)',
  bronze: '#9A5B2C',
  silver: '#5F6670',
  gold: '#8A6A00',
};

export const hawemDark: HawemColors = {
  canvas: '#0B0B0D',
  surface: '#1C1C1E',
  surfaceRaised: '#2C2C2E',
  ink: '#F5F5F7',
  ink2: '#AEAEB2',
  ink3: '#8E8E93',
  hairline: 'rgba(255, 255, 255, 0.10)',
  accent: '#3DD68C',
  accentSoft: '#0F2E23',
  onAccent: '#0B0B0D',
  danger: '#FF6B6B',
  warning: '#F5B544',
  cat: '#8EA2FF',
  dog: '#FF9A62',
  dangerSoft: '#3A1616',
  warningSoft: '#33260C',
  catSoft: '#1C2140',
  dogSoft: '#3A1E10',
  fill: 'rgba(118, 118, 128, 0.24)',
  bronze: '#E0A574',
  silver: '#C7CCD4',
  gold: '#F2CC4D',
};

export type HawemTypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '600' | '700';
};

export const hawemType = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} satisfies Record<string, HawemTypeStyle>;

export const hawemSpace = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  gutter: 20,
} as const;
export const hawemRadius = { sm: 10, lg: 18, pill: 999 } as const;
export const hawemTouch = { min: 44 } as const;
