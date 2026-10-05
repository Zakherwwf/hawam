/**
 * Live route guidance: where the walker is along a fixed route, whether they
 * are heading the way the route is drawn, how far the start is, and the
 * direction chevrons drawn on the map. Pure functions (tested in
 * routeGuidance.test.ts), shared by both map renderers and the walk screen.
 *
 * Waypoints are [lat, lon] like the rest of the app. Geometry uses a local
 * equirectangular projection around the route, accurate to a metre or two
 * over the few kilometres a transect spans. The research portal checks the
 * same rules after upload (apps/dashboard/src/lib/compliance.ts).
 */

export type LatLon = [number, number];
type XY = [number, number];

function projector(origin: LatLon) {
  const k = Math.cos((origin[0] * Math.PI) / 180);
  return {
    to: ([lat, lon]: LatLon): XY => [(lon - origin[1]) * 111320 * k, (lat - origin[0]) * 110540],
    from: ([x, y]: XY): LatLon => [origin[0] + y / 110540, origin[1] + x / (111320 * k)],
  };
}

export interface RouteFrame {
  pts: XY[];
  cum: number[];
  total: number;
  to: (p: LatLon) => XY;
  from: (p: XY) => LatLon;
}

/** Precompute the projected route once; reuse it for every GPS fix. */
export function routeFrame(waypoints: LatLon[]): RouteFrame | null {
  if (waypoints.length < 2) return null;
  const { to, from } = projector(waypoints[0]);
  const pts = waypoints.map(to);
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1], to, from };
}

/** Distance from the route (m) and position along it (m from the start). */
export function locateOnRoute(frame: RouteFrame, p: LatLon) {
  const q = frame.to(p);
  let best = { offsetM: Infinity, alongM: 0 };
  for (let i = 1; i < frame.pts.length; i++) {
    const [ax, ay] = frame.pts[i - 1];
    const [bx, by] = frame.pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / len2)) : 0;
    const d = Math.hypot(q[0] - (ax + t * dx), q[1] - (ay + t * dy));
    if (d < best.offsetM) best = { offsetM: d, alongM: frame.cum[i - 1] + t * Math.sqrt(len2) };
  }
  return best;
}

export function isLoop(waypoints: LatLon[]) {
  if (waypoints.length < 4) return false;
  const f = routeFrame([waypoints[0], waypoints[waypoints.length - 1]]);
  return !!f && f.total < 60;
}

export type DirectionRule = 'as_drawn' | 'either';

export interface Guidance {
  /** Metres to the start point; null once the walker has reached it */
  toStartM: number | null;
  /** The walker has been at the start point (the screen keeps this sticky) */
  started: boolean;
  /** True when recent progress runs against a one-way route */
  wrongWay: boolean;
  /** Share of the route covered so far (furthest point reached), 0..1 */
  progress: number;
}

/**
 * Guidance from the recent fixes (oldest first). Wrong way needs a clear
 * backwards trend: at least 25 m of net backwards progress over the last
 * fixes while on the route, so GPS jitter and a step back to look at an
 * animal do not raise it. Jumps across a loop's seam are ignored.
 */
export function guidance(
  frame: RouteFrame,
  recent: LatLon[],
  rule: DirectionRule,
  opts: { onRouteM?: number; startedOnRoute?: boolean } = {}
): Guidance {
  const onRoute = opts.onRouteM ?? 40;
  const located = recent.map((p) => locateOnRoute(frame, p));
  const last = located[located.length - 1];
  const furthest = located.reduce((m, l) => (l.offsetM <= onRoute ? Math.max(m, l.alongM) : m), 0);
  let net = 0;
  for (let i = 1; i < located.length; i++) {
    if (located[i].offsetM > onRoute || located[i - 1].offsetM > onRoute) continue;
    const d = located[i].alongM - located[i - 1].alongM;
    if (Math.abs(d) < frame.total / 2) net += d;
  }
  const startXY = frame.pts[0];
  const here = recent.length ? frame.to(recent[recent.length - 1]) : startXY;
  const dStart = Math.hypot(here[0] - startXY[0], here[1] - startXY[1]);
  // Started means having been at the start point, not merely on the line:
  // someone at the far end of a one-way route still needs to go to the start
  const started =
    opts.startedOnRoute || located.some((l) => l.offsetM <= onRoute && l.alongM <= onRoute);
  return {
    toStartM: rule === 'as_drawn' && !started && dStart > onRoute ? Math.round(dStart) : null,
    started,
    wrongWay: rule === 'as_drawn' && !!last && last.offsetM <= onRoute && net < -25,
    progress: frame.total ? Math.min(1, furthest / frame.total) : 0,
  };
}

/** Is the local time inside the route's window (windows may wrap midnight)? */
export function inTimeWindow(now: Date, start: string | null, end: string | null) {
  if (!start || !end) return true;
  const m = now.getHours() * 60 + now.getMinutes();
  const toMin = (s: string) => {
    const [h, mm] = s.split(':').map(Number);
    return h * 60 + (mm || 0);
  };
  const a = toMin(start);
  const b = toMin(end);
  return a <= b ? m >= a && m <= b : m >= a || m <= b;
}

/**
 * Small ">" chevrons every `spacingM` along the route pointing the walking
 * direction, as plain line segments so both map renderers can draw them
 * without icon images. Each chevron is two arms of `armM` metres.
 */
export function directionChevrons(waypoints: LatLon[], spacingM = 60, armM = 7): LatLon[][] {
  const f = routeFrame(waypoints);
  if (!f || f.total < spacingM / 2) return [];
  const out: LatLon[][] = [];
  let seg = 1;
  for (let s = spacingM / 2; s < f.total; s += spacingM) {
    while (seg < f.cum.length - 1 && f.cum[seg] < s) seg++;
    const a = f.pts[seg - 1];
    const b = f.pts[seg];
    const len = f.cum[seg] - f.cum[seg - 1] || 1;
    const t = (s - f.cum[seg - 1]) / len;
    const tip: XY = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    // Arms swept back 35 degrees either side of the heading
    const c = Math.cos((145 * Math.PI) / 180);
    const sn = Math.sin((145 * Math.PI) / 180);
    const arm = (sign: number): XY => [
      tip[0] + armM * (ux * c - sign * uy * sn),
      tip[1] + armM * (sign * ux * sn + uy * c),
    ];
    out.push([f.from(arm(1)), f.from(tip), f.from(arm(-1))]);
  }
  return out;
}
