import test from 'node:test';
import assert from 'node:assert/strict';
import { overview, weekly } from '../src/lib/stats.ts';
import { distanceRows, effortRows } from '../src/lib/exports.ts';
import { toCsv } from '../src/lib/csv.ts';
import { lineLengthKm, lineToEwkt } from '../src/lib/geo.ts';

const walk = (id: string, over: object = {}) =>
  ({
    id,
    observer_id: 'u1',
    protocol: 'transect',
    start_time: '2026-09-28T08:00:00Z',
    end_time: '2026-09-28T08:40:00Z',
    duration_min: 40,
    distance_km: 2,
    complete_session: true,
    number_of_observers: 1,
    weather: null,
    time_of_day: null,
    validation_status: 'valid',
    validation_reasons: [],
    country_code: 'PT',
    route_id: null,
    observer: null,
    ...over,
  }) as never;
const seen = (id: string, session: string, over: object = {}) =>
  ({
    id,
    session_id: session,
    observed_at: '2026-09-28T08:10:00Z',
    species: 'cat',
    group_size: 2,
    public_code: `CAT-${id}`,
    perpendicular_distance_m: 4.2,
    ...over,
  }) as never;

test('overview: flagged walks leave effort, zero-count complete walks are counted', () => {
  const o = overview(
    [
      walk('a'),
      walk('b'),
      walk('c', { validation_status: 'flagged' }),
      walk('d', { protocol: 'incidental', distance_km: 0 }),
    ],
    [seen('1', 'a')],
    null
  );
  assert.equal(o.walks, 2);
  assert.equal(o.km, 4);
  assert.equal(o.complete, 2);
  assert.equal(o.zero, 1);
  assert.equal(o.flagged, 1);
  assert.equal(o.quick, 1);
  assert.equal(o.animals, 2);
});

test('weekly: buckets by Monday week, oldest first', () => {
  const w = weekly(
    [walk('a'), walk('b', { start_time: '2026-09-21T08:00:00Z', distance_km: 1 })],
    3,
    new Date('2026-09-30T12:00:00Z')
  );
  assert.equal(w.length, 3);
  assert.equal(w[2].km, 2);
  assert.equal(w[1].km, 1);
});

test('distanceRows: measured detections only; empty transects keep their effort', () => {
  const r = distanceRows(
    [walk('a'), walk('b'), walk('c', { complete_session: false })],
    [seen('1', 'a'), seen('2', 'a', { perpendicular_distance_m: null })]
  );
  assert.equal(r.transects, 2);
  assert.equal(r.skipped, 1);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows.find((x) => x['Sample.Label'] === 'b')?.distance, '');
  assert.equal(r.rows.find((x) => x['Sample.Label'] === 'a')?.distance, 4.2);
});

test('effortRows: detections and zero-count sessions', () => {
  const e = effortRows([walk('a'), walk('b')], [seen('1', 'a')]);
  assert.equal(e[0].animals, 2);
  assert.equal(e[1].detections, 0);
});

test('toCsv: quotes, BOM and arrays', () => {
  const c = toCsv([{ a: 'x,y', b: ['p', 'q'], c: 'say "hi"' }]);
  assert.equal(c, '﻿a,b,c\r\n"x,y",p;q,"say ""hi"""');
});

test('geo: EWKT in lon lat order and a sensible length', () => {
  assert.equal(
    lineToEwkt([
      [10, 36],
      [10.01, 36],
    ]),
    'SRID=4326;LINESTRING(10 36, 10.01 36)'
  );
  const km = lineLengthKm([
    [10, 36],
    [10.01, 36],
  ]);
  assert.ok(km > 0.89 && km < 0.91, String(km));
});
