import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCoordinates, formatObservedAt } from '../utils/formatObservation.ts';

test('formatCoordinates: hemisphere letters follow the sign', () => {
  assert.equal(formatCoordinates(36.8021, 10.1797), '36.80210° N, 10.17970° E');
  assert.equal(formatCoordinates(-12.04955, -77.04433), '12.04955° S, 77.04433° W');
  assert.equal(formatCoordinates(-33.9, 151.2), '33.90000° S, 151.20000° E');
});

test('formatObservedAt: today, yesterday, then a date', () => {
  const now = new Date(2026, 8, 30, 12, 0);
  const labels = { today: 'Today', yesterday: 'Yesterday' };
  assert.match(
    formatObservedAt(new Date(2026, 8, 30, 9, 29).toISOString(), labels, now),
    /^Today, /
  );
  assert.match(
    formatObservedAt(new Date(2026, 8, 29, 18, 2).toISOString(), labels, now),
    /^Yesterday, /
  );
  const older = formatObservedAt(new Date(2026, 8, 3, 7, 45).toISOString(), labels, now);
  assert.ok(
    !older.startsWith('Today') && !older.startsWith('Yesterday') && older.includes(','),
    older
  );
  assert.equal(formatObservedAt('not a date', labels, now), '');
});
