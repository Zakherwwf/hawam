import test from 'node:test';
import assert from 'node:assert/strict';
import { labelOwnSightings, mergeForMap } from '../app-state/mergeSightings.ts';

const row = (id: string, code: string, extra: Record<string, unknown> = {}) => ({
  id,
  observed_at: '2026-09-29T08:00:00Z',
  species: 'dog' as const,
  group_size: 1,
  body_condition_score: null,
  notes: null,
  latitude: 36.8,
  longitude: 10.18,
  perpendicular_distance_m: null,
  observer_id: 'u2',
  observer_name: 'Amel',
  protocol: 'incidental' as const,
  public_code: code,
  ...extra,
});
const local = (id: string) => ({
  id,
  species: 'cat' as const,
  group_size: 1,
  latitude: 36.81,
  longitude: 10.19,
  observed_at: '2026-09-29T09:00:00Z',
  protocol: 'incidental' as const,
  identifier: 'my-tag',
  photos: ['file:///p.jpg'],
});

test('mergeSightings: map shows every server row plus unsynced local ones, no duplicates', () => {
  const merged = mergeForMap(
    [local('synced-1'), local('pending-1')],
    [row('synced-1', 'CAT-000007'), row('other-user', 'DOG-000003')]
  );
  assert.equal(merged.length, 3);
  assert.equal(merged.filter((s) => s.id === 'synced-1').length, 1);
  assert.equal(merged.find((s) => s.id === 'synced-1')?.publicCode, 'CAT-000007');
  assert.equal(merged.find((s) => s.id === 'pending-1')?.syncPending, true);
  assert.equal(merged.find((s) => s.id === 'other-user')?.observer_name, 'Amel');
});

test('mergeSightings: own sightings take the server code and keep local photos and tag', () => {
  const [a, b] = labelOwnSightings(
    [local('synced-1'), local('pending-1')],
    [row('synced-1', 'CAT-000007')]
  );
  assert.equal(a.publicCode, 'CAT-000007');
  assert.equal(a.syncPending, false);
  assert.deepEqual(a.photos, ['file:///p.jpg']);
  assert.equal(a.identifier, 'my-tag');
  assert.equal(b.publicCode, undefined);
  assert.equal(b.syncPending, true);
});

test('mergeSightings: server rows without a position are skipped', () => {
  assert.equal(mergeForMap([], [row('x', 'DOG-000001', { latitude: null })]).length, 0);
});
