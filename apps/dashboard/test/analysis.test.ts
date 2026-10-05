import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, previousWindow, readFilters } from '../src/lib/filters.ts';
import { linearTrend, rolling, series, splitSeries, total } from '../src/lib/series.ts';
import { compliance, previousVisitOf, rotateLoop } from '../src/lib/compliance.ts';

const walk = (id: string, over: object = {}) =>
  ({
    id,
    observer_id: 'u1',
    protocol: 'transect',
    start_time: '2026-09-28T08:00:00',
    end_time: '2026-09-28T08:40:00',
    duration_min: 40,
    distance_km: 2,
    complete_session: true,
    number_of_observers: 1,
    weather: null,
    time_of_day: null,
    validation_status: 'valid',
    validation_reasons: [],
    country_code: 'TN',
    route_id: null,
    observer: null,
    ...over,
  }) as never;
const seen = (id: string, session: string, over: object = {}) =>
  ({
    id,
    session_id: session,
    observed_at: '2026-09-28T08:10:00',
    species: 'cat',
    group_size: 2,
    public_code: `CAT-${id}`,
    ...over,
  }) as never;

test('filters: species filters sightings but never drops walks (absences stay effort)', () => {
  const f = readFilters(new URLSearchParams('range=all&sp=dog'));
  const out = applyFilters(
    [walk('a'), walk('b')],
    [seen('1', 'a'), seen('2', 'b', { species: 'dog' })],
    f
  );
  assert.equal(out.walks.length, 2);
  assert.deepEqual(
    out.sightings.map((s: { id: string }) => s.id),
    ['2']
  );
});

test('filters: custom range is inclusive of the end day; previous window has equal length', () => {
  const f = readFilters(new URLSearchParams('from=2026-09-01&to=2026-09-10'));
  assert.equal(f.range, 'custom');
  assert.equal(f.to!.getDate(), 11);
  const p = previousWindow(f)!;
  assert.equal(p.to!.getTime(), f.from!.getTime());
  assert.equal(f.to!.getTime() - f.from!.getTime(), p.to!.getTime() - p.from!.getTime());
});

test('series: encounter rate uses complete transects only and flagged walks leave effort', () => {
  const walks = [
    walk('a'),
    walk('b', { complete_session: false }),
    walk('c', { validation_status: 'flagged' }),
  ];
  const sightings = [seen('1', 'a'), seen('2', 'b'), seen('3', 'c')];
  assert.equal(total(walks, sightings, 'km'), 4);
  assert.equal(total(walks, sightings, 'rate'), 1); // 2 animals over 2 km on the one complete walk
  assert.equal(total(walks, sightings, 'animals'), 4); // flagged walk's animals excluded
  assert.equal(total(walks, sightings, 'flagged'), 1);
});

test('series: empty buckets are zero, not missing; ratio buckets without effort are null', () => {
  const from = new Date('2026-09-26T00:00:00');
  const to = new Date('2026-09-30T00:00:00');
  const km = series([walk('a')], [], 'km', from, to, 'day');
  assert.equal(km.length, 4);
  assert.deepEqual(
    km.map((p) => p.v),
    [0, 0, 2, 0]
  );
  const rate = series([walk('a')], [], 'rate', from, to, 'day');
  assert.equal(rate[0].v, null);
  assert.equal(rate[2].v, 0); // a complete zero-animal walk is a real zero
});

test('series: species breakdown splits sighting metrics', () => {
  const from = new Date('2026-09-28T00:00:00');
  const to = new Date('2026-09-29T00:00:00');
  const g = splitSeries(
    [walk('a')],
    [seen('1', 'a'), seen('2', 'a', { species: 'dog', group_size: 5 })],
    'animals',
    from,
    to,
    'day',
    'species',
    (k) => k
  );
  assert.deepEqual(
    g.map((x) => [x.key, x.total]),
    [
      ['dog', 5],
      ['cat', 2],
    ]
  );
});

test('trend: least squares slope and rolling mean', () => {
  const pts = [1, 2, 3, 4].map((v, i) => ({ t: new Date(2026, 0, i + 1), v }));
  const t = linearTrend(pts)!;
  assert.ok(Math.abs(t.slope - 1) < 1e-9);
  assert.ok(Math.abs(t.r2 - 1) < 1e-9);
  assert.deepEqual(
    rolling(pts, 2).map((p) => p.v),
    [1, 1.5, 2.5, 3.5]
  );
});

const route = {
  id: 'r',
  name: 'Test',
  geometry: {
    type: 'LineString',
    coordinates: [
      [10.17, 36.8],
      [10.18, 36.8],
    ] as [number, number][],
  },
  direction_rule: 'as_drawn',
  strip_width_m: 25,
  window_start: '07:00',
  window_end: '10:00',
  revisit_days: 7,
  require_complete: true,
} as never;
const line = (from: number, to: number) =>
  Array.from({ length: 21 }, (_, i) => [from + ((to - from) * i) / 20, 36.8] as [number, number]);

test('compliance: forward walk along the whole line passes', () => {
  const c = compliance(walk('a', { route_id: 'r' }), line(10.17, 10.18), route, null)!;
  assert.equal(c.direction, 'forward');
  assert.ok(c.coverage > 0.95);
  assert.ok(c.startOffsetM < 5);
  assert.equal(c.checks.find((x) => x.id === 'direction')!.state, 'pass');
  assert.equal(c.checks.find((x) => x.id === 'window')!.state, 'pass');
});

test('compliance: reversed walk fails direction and start; half walk fails coverage', () => {
  const rev = compliance(walk('a', { route_id: 'r' }), line(10.18, 10.17), route, null)!;
  assert.equal(rev.direction, 'reverse');
  assert.equal(rev.checks.find((x) => x.id === 'direction')!.state, 'fail');
  assert.equal(rev.checks.find((x) => x.id === 'start')!.state, 'fail');
  const half = compliance(walk('b', { route_id: 'r' }), line(10.17, 10.175), route, null)!;
  assert.equal(half.checks.find((x) => x.id === 'coverage')!.state, 'fail');
});

test('compliance: either-direction routes accept a reversed walk; revisit gap is checked', () => {
  const either = { ...(route as object), direction_rule: 'either' } as never;
  const c = compliance(walk('a', { route_id: 'r' }), line(10.18, 10.17), either, null)!;
  assert.equal(c.checks.find((x) => x.id === 'direction')!.state, 'pass');
  assert.equal(c.checks.find((x) => x.id === 'start')!.state, 'pass');
  const earlier = walk('z', { route_id: 'r', start_time: '2026-09-25T08:00:00' });
  const now = walk('a', { route_id: 'r' });
  const prev = previousVisitOf(now, [now, earlier]);
  assert.equal(prev && (prev as { id: string }).id, 'z');
  const r = compliance(now, line(10.17, 10.18), route, prev)!;
  assert.equal(r.checks.find((x) => x.id === 'revisit')!.state, 'warn');
});

test('rotateLoop keeps the loop closed with the chosen vertex first', () => {
  const loop: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ];
  assert.deepEqual(rotateLoop(loop, 2), [
    [1, 1],
    [0, 1],
    [0, 0],
    [1, 0],
    [1, 1],
  ]);
});
