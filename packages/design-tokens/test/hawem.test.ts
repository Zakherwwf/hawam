import test from 'node:test';
import assert from 'node:assert/strict';
import { getContrastRatio } from '../src/colors.ts';
import { hawemDark, hawemLight } from '../src/hawem.ts';

for (const [scheme, c] of [
  ['light', hawemLight],
  ['dark', hawemDark],
] as const) {
  test(`hawem ${scheme}: every text colour passes AA on canvas and surface`, () => {
    for (const token of [
      'ink',
      'ink2',
      'ink3',
      'accent',
      'danger',
      'warning',
      'cat',
      'dog',
    ] as const) {
      for (const bg of [c.canvas, c.surface]) {
        const r = getContrastRatio(c[token], bg);
        assert.ok(r >= 4.5, `${scheme} ${token} on ${bg}: ${r.toFixed(2)}`);
      }
    }
  });
  test(`hawem ${scheme}: text on the action colour and selected states passes AA`, () => {
    assert.ok(getContrastRatio(c.onAccent, c.accent) >= 4.5);
    assert.ok(getContrastRatio(c.accent, c.accentSoft) >= 4.5);
    assert.ok(getContrastRatio(c.danger, c.dangerSoft) >= 4.5);
    assert.ok(getContrastRatio(c.warning, c.warningSoft) >= 4.5);
    assert.ok(getContrastRatio(c.cat, c.catSoft) >= 4.5);
    assert.ok(getContrastRatio(c.dog, c.dogSoft) >= 4.5);
  });
  test(`hawem ${scheme}: badge tiers are legible on the surface`, () => {
    for (const token of ['bronze', 'silver', 'gold'] as const) {
      const r = getContrastRatio(c[token], c.surface);
      assert.ok(r >= 4.5, `${scheme} ${token}: ${r.toFixed(2)}`);
    }
  });
}
