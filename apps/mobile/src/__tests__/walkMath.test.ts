import test from 'node:test';
import assert from 'node:assert/strict';
import { bearingFromSide, nearbyTags, surveyXpPreview } from '../features/survey/walkMath.ts';

test('bearingFromSide: relative side to a compass bearing', () => {
  assert.equal(bearingFromSide(0, 'ahead'), 0);
  assert.equal(bearingFromSide(350, 'right'), 80);
  assert.equal(bearingFromSide(10, 'left'), 280);
  assert.equal(bearingFromSide(200, 'behind'), 20);
});

test('surveyXpPreview: server weights, zero-animal walks still earn the session', () => {
  const zero = surveyXpPreview({ km: 2.4, observations: [] });
  assert.equal(zero.total, 25 + 10);
  const some = surveyXpPreview({
    km: 1.2,
    observations: [
      { group_size: 3, hasPhoto: true },
      { group_size: 1, hasPhoto: false },
    ],
  });
  // 25 session + 5 km + 2 obs * 10 + 2 extra animals * 2 + 1 photo * 15
  assert.equal(some.total, 25 + 5 + 20 + 4 + 15);
});

test('nearbyTags: own tags for the species, nearest first, codes excluded', () => {
  const s = [
    { species: 'cat', identifier: 'Ginger', latitude: 36.8001, longitude: 10.18 },
    { species: 'cat', identifier: 'Patch', latitude: 36.8, longitude: 10.1801 },
    { species: 'cat', identifier: 'Far', latitude: 36.9, longitude: 10.18 },
    { species: 'dog', identifier: 'Rex', latitude: 36.8, longitude: 10.18 },
    { species: 'cat', identifier: 'CAT-000012', latitude: 36.8, longitude: 10.18 },
    { species: 'cat', identifier: 'Ginger', latitude: 36.8, longitude: 10.18 },
  ];
  assert.deepEqual(nearbyTags(s, 'cat', 36.8, 10.18), ['Ginger', 'Patch']);
});

test('timeOfDay: local start hour to the database enum', async () => {
  const { timeOfDay } = await import('../features/survey/walkMath.ts');
  assert.equal(timeOfDay(new Date(2026, 8, 30, 6, 30)), 'dawn');
  assert.equal(timeOfDay(new Date(2026, 8, 30, 12)), 'midday');
  assert.equal(timeOfDay(new Date(2026, 8, 30, 18, 59)), 'dusk');
  assert.equal(timeOfDay(new Date(2026, 8, 30, 23)), 'night');
});
