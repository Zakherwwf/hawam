/**
 * Hawem design system v3.1 (docs/DESIGN.md). Palette sampled from the
 * reference boards in "inspirations for image to code": deep green #144513
 * and lime #B1EC6F (board 2), warm orange #F1721D and the sky/grass
 * illustration tones (board 4), gradient heroes (boards 1 and 3). Every text
 * colour passes WCAG AA on canvas and surface in both schemes
 * (test/hawem.test.ts).
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
  /** Lime highlight (board 2): active bars, secondary buttons, selected states */
  lime: string;
  limeSoft: string;
  onLime: string;
  /** Warm orange (board 4): streaks, celebrations. warmInk is its text-safe shade */
  warm: string;
  warmSoft: string;
  warmInk: string;
}

export const hawemLight: HawemColors = {
  canvas: '#F2F4F5',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  ink: '#16181D',
  ink2: '#52565E',
  ink3: '#6B7078',
  hairline: 'rgba(0, 0, 0, 0.07)',
  accent: '#144513',
  accentSoft: '#E9FAD6',
  onAccent: '#FFFFFF',
  danger: '#C62828',
  warning: '#8A5A00',
  cat: '#3865CC',
  dog: '#C2410C',
  dangerSoft: '#FDECEC',
  warningSoft: '#FBF1DD',
  catSoft: '#E6EEFB',
  dogSoft: '#FDF1EA',
  fill: 'rgba(118, 118, 128, 0.12)',
  bronze: '#9A5B2C',
  silver: '#5F6670',
  gold: '#8A6A00',
  lime: '#B1EC6F',
  limeSoft: '#F4FFE9',
  onLime: '#144513',
  warm: '#F1721D',
  warmSoft: '#FFEEDF',
  warmInk: '#A9480A',
};

export const hawemDark: HawemColors = {
  canvas: '#0B0D0B',
  surface: '#1A1D1A',
  surfaceRaised: '#262A26',
  ink: '#F3F6F1',
  ink2: '#B2B8AE',
  ink3: '#90968C',
  hairline: 'rgba(255, 255, 255, 0.10)',
  accent: '#B1EC6F',
  accentSoft: '#1E3314',
  onAccent: '#102B0F',
  danger: '#FF6B6B',
  warning: '#F5B544',
  cat: '#8EA8FF',
  dog: '#FF9A62',
  dangerSoft: '#3A1616',
  warningSoft: '#33260C',
  catSoft: '#1C2442',
  dogSoft: '#3A1E10',
  fill: 'rgba(118, 128, 118, 0.24)',
  bronze: '#E0A574',
  silver: '#C7CCD4',
  gold: '#F2CC4D',
  lime: '#B1EC6F',
  limeSoft: '#1E3314',
  onLime: '#102B0F',
  warm: '#F58A3E',
  warmSoft: '#3A2210',
  warmInk: '#FFA564',
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
export const hawemRadius = { sm: 12, lg: 22, xl: 28, pill: 999 } as const;
export const hawemTouch = { min: 44 } as const;

/**
 * Gradients, top to bottom (or start to end). Heroes carry white text only on
 * their darker first two stops; the last stop fades towards the canvas.
 */
export const hawemGradients = {
  light: {
    hero: ['#144513', '#2F7A2B', '#8FD45C'],
    lime: ['#C9F28F', '#B1EC6F'],
    sky: ['#A6E2F9', '#E3F6FD'],
    sunrise: ['#F25A30', '#F1721D', '#FBDFC6'],
    ocean: ['#3865CC', '#68A5E0', '#A8E6E1'],
    gold: ['#F6D66B', '#D9A826'],
    silver: ['#E4E8EE', '#AEB6C2'],
    bronze: ['#F0B58A', '#B8733F'],
  },
  dark: {
    hero: ['#0A230A', '#144513', '#2F7A2B'],
    lime: ['#B1EC6F', '#8FD45C'],
    sky: ['#12324A', '#0B0D0B'],
    sunrise: ['#8A2C14', '#B4520D', '#3A2210'],
    ocean: ['#1C3A7A', '#2A5A9A', '#1F4E52'],
    gold: ['#F6D66B', '#C8961A'],
    silver: ['#E4E8EE', '#9AA3B0'],
    bronze: ['#F0B58A', '#A8652F'],
  },
} as const;
