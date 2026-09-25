export interface ColorTokens {
  bg: string;
  bgElevated: string;
  surfaceGlass: string;
  label: string;
  labelSecondary: string;
  labelTertiary: string;
  separator: string;
  accent: string;
  accentContrast: string;
  cat: string;
  dog: string;
  success: string;
  warning: string;
  danger: string;
  gpsGood: string;
  gpsFair: string;
  gpsPoor: string;
  hudText: string;
  hudBg: string;
}

export const lightColors: ColorTokens = {
  bg: '#F8F9FA',
  bgElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',
  label: '#111827',
  labelSecondary: '#4B5563',
  labelTertiary: '#6B7280',
  separator: '#E5E7EB',
  accent: '#0284C7',
  accentContrast: '#FFFFFF',
  cat: '#0D9488',
  dog: '#D97706',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  gpsGood: '#16A34A',
  gpsFair: '#D97706',
  gpsPoor: '#DC2626',
  hudText: '#FFFFFF',
  hudBg: '#0F172A',
};

export const darkColors: ColorTokens = {
  bg: '#0A0F1D',
  bgElevated: '#151E32',
  surfaceGlass: 'rgba(21, 30, 50, 0.85)',
  label: '#F9FAFB',
  labelSecondary: '#9CA3AF',
  labelTertiary: '#6B7280',
  separator: '#1F2937',
  accent: '#38BDF8',
  accentContrast: '#0A0F1D',
  cat: '#2DD4BF',
  dog: '#FBBF24',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  gpsGood: '#4ADE80',
  gpsFair: '#FBBF24',
  gpsPoor: '#F87171',
  hudText: '#FFFFFF',
  hudBg: '#0F172A',
};

export const colors = {
  light: lightColors,
  dark: darkColors,
};

export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const [r1, g1, b1] = hexToRgb(foregroundHex);
  const [r2, g2, b2] = hexToRgb(backgroundHex);
  const l1 = getRelativeLuminance(r1, g1, b1);
  const l2 = getRelativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
