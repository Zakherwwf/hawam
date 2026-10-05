import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, measurementSystemForLocale, toMeters } from '../utils/units.ts';

test('units: US, Liberia and Myanmar locales use feet; others use metres', () => {
  assert.equal(measurementSystemForLocale('en-US'), 'imperial');
  assert.equal(measurementSystemForLocale('es_US'), 'imperial');
  assert.equal(measurementSystemForLocale('en-GB'), 'metric');
  assert.equal(measurementSystemForLocale('fr-TN'), 'metric');
  assert.equal(measurementSystemForLocale('zh-Hant-TW'), 'metric');
  assert.equal(measurementSystemForLocale('en'), 'metric');
});

test('units: display converts, storage value is untouched metres', () => {
  assert.equal(formatDistance(12.5, 'metric'), '12.5 m');
  assert.equal(formatDistance(10, 'imperial'), '33 ft');
  assert.ok(Math.abs(toMeters(33, 'imperial') - 10.0584) < 1e-9);
  assert.equal(toMeters(7, 'metric'), 7);
});
