import test from 'node:test';
import assert from 'node:assert/strict';
import { getContrastRatio } from '../src/colors.ts';
import { brandPalette, dayTheme, nightTheme, lightSurfaces } from '../src/brand.ts';

const TEXT_TOKENS = [
  'label',
  'secondaryLabel',
  'tertiaryLabel',
  'successText',
  'warningText',
  'dangerText',
  'systemBlue',
] as const;

for (const token of TEXT_TOKENS) {
  test(`brand: ${token} meets WCAG AA (4.5:1) on every light surface`, () => {
    for (const surface of lightSurfaces) {
      const ratio = getContrastRatio(brandPalette[token], surface);
      assert.ok(
        ratio >= 4.5,
        `${token} ${brandPalette[token]} on ${surface}: ${ratio.toFixed(2)}:1`
      );
    }
  });
}

test('brand: day and night theme text meets AA on their own backgrounds', () => {
  for (const theme of [dayTheme, nightTheme]) {
    for (const bg of [theme.screenBg, theme.cardBg]) {
      assert.ok(getContrastRatio(theme.textPrimary, bg) >= 4.5);
      assert.ok(
        getContrastRatio(theme.textSecondary, bg) >= 4.5,
        `${theme.textSecondary} on ${bg}`
      );
    }
  }
});

test('brand: citron is unreadable on light surfaces (documented dark-only accent)', () => {
  assert.ok(getContrastRatio(brandPalette.citron, brandPalette.systemBackground) < 1.5);
  assert.ok(getContrastRatio(brandPalette.citron, nightTheme.screenBg) >= 7);
});
