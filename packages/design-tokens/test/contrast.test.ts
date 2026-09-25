import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lightColors,
  darkColors,
  getContrastRatio,
} from '../src/colors.ts';

test('design-tokens: Light mode label meets WCAG AA contrast ratio >= 4.5:1 against bg', () => {
  const ratio = getContrastRatio(lightColors.label, lightColors.bg);
  assert.ok(
    ratio >= 4.5,
    `Light mode primary label contrast must be >= 4.5:1, got ${ratio.toFixed(2)}:1`
  );
});

test('design-tokens: Light mode secondary label meets WCAG AA contrast ratio >= 4.5:1 against bg', () => {
  const ratio = getContrastRatio(lightColors.labelSecondary, lightColors.bg);
  assert.ok(
    ratio >= 4.5,
    `Light mode secondary label contrast must be >= 4.5:1, got ${ratio.toFixed(2)}:1`
  );
});

test('design-tokens: Dark mode primary label meets WCAG AA contrast ratio >= 4.5:1 against bg', () => {
  const ratio = getContrastRatio(darkColors.label, darkColors.bg);
  assert.ok(
    ratio >= 4.5,
    `Dark mode primary label contrast must be >= 4.5:1, got ${ratio.toFixed(2)}:1`
  );
});

test('design-tokens: Dark mode secondary label meets WCAG AA contrast ratio >= 4.5:1 against bg', () => {
  const ratio = getContrastRatio(darkColors.labelSecondary, darkColors.bg);
  assert.ok(
    ratio >= 4.5,
    `Dark mode secondary label contrast must be >= 4.5:1, got ${ratio.toFixed(2)}:1`
  );
});

test('design-tokens: HUD text meets high contrast requirement >= 7:1 against HUD background', () => {
  const ratio = getContrastRatio(lightColors.hudText, lightColors.hudBg);
  assert.ok(
    ratio >= 7.0,
    `HUD text contrast against HUD background must be >= 7:1, got ${ratio.toFixed(2)}:1`
  );
});
