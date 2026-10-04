import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directionChevrons,
  guidance,
  inTimeWindow,
  isLoop,
  locateOnRoute,
  routeFrame,
  type LatLon,
} from '../features/routes/routeGuidance.ts';

// About 890 m due east along a parallel
const route: LatLon[] = [
  [36.8, 10.17],
  [36.8, 10.18],
];
const walk = (from: number, to: number, n = 12): LatLon[] =>
  Array.from({ length: n }, (_, i) => [36.8, from + ((to - from) * i) / (n - 1)]);

test('locateOnRoute: position along and distance from the line', () => {
  const f = routeFrame(route)!;
  const mid = locateOnRoute(f, [36.8, 10.175]);
  assert.ok(Math.abs(mid.alongM - f.total / 2) < 2);
  assert.ok(mid.offsetM < 1);
  const off = locateOnRoute(f, [36.8005, 10.175]);
  assert.ok(off.offsetM > 50 && off.offsetM < 60);
});

test('guidance: walking as drawn is fine, walking back raises wrong way', () => {
  const f = routeFrame(route)!;
  const ok = guidance(f, walk(10.17, 10.174), 'as_drawn');
  assert.equal(ok.wrongWay, false);
  assert.equal(ok.toStartM, null);
  assert.ok(ok.progress > 0.35 && ok.progress < 0.45);
  const back = guidance(f, walk(10.176, 10.172), 'as_drawn', { startedOnRoute: true });
  assert.equal(back.wrongWay, true);
});

test('guidance: either-direction routes never warn; jitter does not warn', () => {
  const f = routeFrame(route)!;
  assert.equal(guidance(f, walk(10.176, 10.172), 'either').wrongWay, false);
  const jitter: LatLon[] = [10.175, 10.17498, 10.17502, 10.17497, 10.17501].map((lon) => [
    36.8,
    lon,
  ]);
  assert.equal(guidance(f, jitter, 'as_drawn', { startedOnRoute: true }).wrongWay, false);
});

test('guidance: far from the start before starting asks to go to the start', () => {
  const f = routeFrame(route)!;
  const g = guidance(f, [[36.8, 10.169]], 'as_drawn');
  assert.ok(g.toStartM != null && g.toStartM > 80 && g.toStartM < 100);
  // Standing at the far end (wrong start) also asks to go to the start
  const end = guidance(f, [[36.8, 10.18]], 'as_drawn');
  assert.ok(end.toStartM != null && end.toStartM > 850);
});

test('inTimeWindow handles plain and overnight windows', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 4, h, m);
  assert.equal(inTimeWindow(at(8), '07:00', '10:00'), true);
  assert.equal(inTimeWindow(at(11), '07:00', '10:00'), false);
  assert.equal(inTimeWindow(at(23), '22:00', '02:00'), true);
  assert.equal(inTimeWindow(at(12), null, null), true);
});

test('directionChevrons: one chevron per spacing, tip on the line pointing forward', () => {
  const ch = directionChevrons(route, 100);
  assert.equal(ch.length, 9);
  const [arm, tip] = ch[0];
  assert.ok(Math.abs(tip[0] - 36.8) < 1e-6); // tip sits on the line
  assert.ok(arm[1] < tip[1]); // arms trail behind the tip (route runs east)
});

test('isLoop detects closed routes', () => {
  assert.equal(
    isLoop([
      [36.8, 10.17],
      [36.801, 10.171],
      [36.8, 10.172],
      [36.8, 10.17],
    ]),
    true
  );
  assert.equal(isLoop(route), false);
});
