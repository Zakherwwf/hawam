import type { RouteRow, Walk } from '../data/api.ts';

/**
 * Did a walk follow its route's protocol? Computed in the browser from the
 * walked track and the route line, so it works on any database version and
 * in preview mode. Geometry uses a local equirectangular projection around
 * the route (metre accuracy over a few km, which is all a transect spans).
 *
 * The checks mirror the route rules researchers set on the Routes page:
 * start point, walking direction, coverage, staying on the line, time window,
 * revisit interval, duration and completeness.
 */
export type CheckState = 'pass' | 'warn' | 'fail' | 'na';
export interface Check {
  id:
    'start' | 'direction' | 'coverage' | 'onroute' | 'window' | 'revisit' | 'duration' | 'complete';
  label: string;
  state: CheckState;
  detail: string;
}
export interface Compliance {
  direction: 'forward' | 'reverse' | 'unclear';
  coverage: number;
  startOffsetM: number;
  offRouteShare: number;
  checks: Check[];
  /** Share of applicable checks passed, 0..1 */
  score: number;
}

type LL = [number, number];
type XY = [number, number];

function projector(origin: LL) {
  const k = Math.cos((origin[1] * Math.PI) / 180);
  return (p: LL): XY => [(p[0] - origin[0]) * 111320 * k, (p[1] - origin[1]) * 110540];
}

/** Nearest point on a polyline: distance (m) and position along it (m). */
function locate(line: XY[], cum: number[], p: XY) {
  let best = { d: Infinity, along: 0 };
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2)) : 0;
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    const d = Math.hypot(p[0] - qx, p[1] - qy);
    if (d < best.d) best = { d, along: cum[i - 1] + t * Math.sqrt(len2) };
  }
  return best;
}

function cumulative(line: XY[]) {
  const cum = [0];
  for (let i = 1; i < line.length; i++)
    cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  return cum;
}

/** Points every `step` metres along a polyline. */
function resample(line: XY[], cum: number[], step: number): XY[] {
  const total = cum[cum.length - 1];
  const out: XY[] = [];
  let seg = 1;
  for (let s = 0; s <= total; s += step) {
    while (seg < cum.length - 1 && cum[seg] < s) seg++;
    const a = line[seg - 1];
    const b = line[seg];
    const span = cum[seg] - cum[seg - 1] || 1;
    const t = (s - cum[seg - 1]) / span;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

const minutesOfDay = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function routeIsLoop(route: RouteRow) {
  const c = route.geometry?.coordinates ?? [];
  if (c.length < 3) return false;
  const p = projector(c[0]);
  const [x, y] = p(c[c.length - 1]);
  return Math.hypot(x, y) < 60;
}

export function compliance(
  walk: Walk,
  track: LL[],
  route: RouteRow,
  previousVisit: Walk | null
): Compliance | null {
  const rc = route.geometry?.coordinates;
  if (!rc || rc.length < 2) return null;
  const P = projector(rc[0]);
  const line = rc.map(P);
  const cum = cumulative(line);
  const total = cum[cum.length - 1] || 1;
  const strip = Math.max(25, (route.strip_width_m ?? 25) + 15);
  const checks: Check[] = [];
  const loop = routeIsLoop(route);

  let direction: Compliance['direction'] = 'unclear';
  let coverage = 0;
  let startOffsetM = Infinity;
  let offRouteShare = 0;

  if (track.length >= 2) {
    const t = track.map(P);
    // Direction: sum the along-route progress between successive samples,
    // ignoring jumps across the seam of a loop.
    const step = Math.max(1, Math.floor(t.length / 40));
    let progress = 0;
    let prev: number | null = null;
    let off = 0;
    let n = 0;
    for (let i = 0; i < t.length; i += step) {
      const loc = locate(line, cum, t[i]);
      n++;
      if (loc.d > strip * 2) off++;
      if (prev != null) {
        const d = loc.along - prev;
        if (Math.abs(d) < total / 2) progress += d;
      }
      prev = loc.along;
    }
    offRouteShare = n ? off / n : 0;
    direction =
      progress > total * 0.15 ? 'forward' : progress < -total * 0.15 ? 'reverse' : 'unclear';

    // Coverage: share of the route (every 20 m) the track passed within the strip
    const samples = resample(line, cum, 20);
    const tcum = cumulative(t);
    let covered = 0;
    for (const s of samples) if (locate(t, tcum, s).d <= strip) covered++;
    coverage = samples.length ? covered / samples.length : 0;

    const first = t[0];
    const dStart = Math.hypot(first[0] - line[0][0], first[1] - line[0][1]);
    const last = line[line.length - 1];
    const dEnd = Math.hypot(first[0] - last[0], first[1] - last[1]);
    startOffsetM = route.direction_rule === 'either' && !loop ? Math.min(dStart, dEnd) : dStart;
  }

  const hasTrack = track.length >= 2;
  checks.push({
    id: 'start',
    label: 'Started at the start point',
    state: !hasTrack ? 'na' : startOffsetM <= 60 ? 'pass' : startOffsetM <= 150 ? 'warn' : 'fail',
    detail: hasTrack ? `${Math.round(startOffsetM)} m from the start` : 'No track recorded',
  });
  const wantForward = route.direction_rule !== 'either';
  checks.push({
    id: 'direction',
    label: wantForward ? 'Walked in the set direction' : 'Direction (either allowed)',
    state: !hasTrack
      ? 'na'
      : !wantForward
        ? 'pass'
        : direction === 'forward'
          ? 'pass'
          : direction === 'reverse'
            ? 'fail'
            : 'warn',
    detail: !hasTrack
      ? 'No track recorded'
      : direction === 'forward'
        ? 'As drawn, start to end'
        : direction === 'reverse'
          ? 'Opposite to the drawn direction'
          : 'Too little movement along the line to tell',
  });
  checks.push({
    id: 'coverage',
    label: 'Covered the whole route',
    state: !hasTrack ? 'na' : coverage >= 0.9 ? 'pass' : coverage >= 0.7 ? 'warn' : 'fail',
    detail: hasTrack ? `${Math.round(coverage * 100)}% of the line walked` : 'No track recorded',
  });
  checks.push({
    id: 'onroute',
    label: 'Stayed on the route',
    state: !hasTrack
      ? 'na'
      : offRouteShare <= 0.1
        ? 'pass'
        : offRouteShare <= 0.25
          ? 'warn'
          : 'fail',
    detail: hasTrack
      ? `${Math.round(offRouteShare * 100)}% of the track off the line`
      : 'No track recorded',
  });

  if (route.window_start && route.window_end) {
    const d = new Date(walk.start_time);
    const m = d.getHours() * 60 + d.getMinutes();
    const a = minutesOfDay(route.window_start);
    const b = minutesOfDay(route.window_end);
    const inside = a <= b ? m >= a && m <= b : m >= a || m <= b;
    checks.push({
      id: 'window',
      label: 'Inside the time window',
      state: inside ? 'pass' : 'fail',
      detail: `Started ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}, window ${route.window_start.slice(0, 5)} to ${route.window_end.slice(0, 5)}`,
    });
  }
  if (route.revisit_days) {
    const gap = previousVisit
      ? (new Date(walk.start_time).getTime() - new Date(previousVisit.start_time).getTime()) /
        86400000
      : null;
    checks.push({
      id: 'revisit',
      label: `At least ${route.revisit_days} days since the last visit`,
      state: gap == null || gap >= route.revisit_days ? 'pass' : 'warn',
      detail:
        gap == null
          ? 'First visit to this route'
          : `${Math.floor(gap)} days after the previous visit`,
    });
  }
  if (route.target_duration_min && walk.duration_min != null) {
    const r = walk.duration_min / route.target_duration_min;
    checks.push({
      id: 'duration',
      label: 'Close to the target duration',
      state: r >= 0.6 && r <= 1.8 ? 'pass' : r >= 0.4 ? 'warn' : 'fail',
      detail: `${Math.round(walk.duration_min)} min against a ${route.target_duration_min} min target`,
    });
  }
  if (route.require_complete !== false) {
    checks.push({
      id: 'complete',
      label: 'Complete checklist',
      state: walk.complete_session ? 'pass' : 'fail',
      detail: walk.complete_session ? 'Every cat and dog recorded' : 'Not every animal recorded',
    });
  }

  const applicable = checks.filter((c) => c.state !== 'na');
  const score = applicable.length
    ? applicable.reduce((a, c) => a + (c.state === 'pass' ? 1 : c.state === 'warn' ? 0.5 : 0), 0) /
      applicable.length
    : 0;
  return { direction, coverage, startOffsetM, offRouteShare, checks, score };
}

/** The visit to the same route just before this walk (unflagged, by anyone). */
export function previousVisitOf(walk: Walk, all: Walk[]) {
  if (!walk.route_id) return null;
  const t = new Date(walk.start_time).getTime();
  let best: Walk | null = null;
  for (const w of all) {
    if (w.id === walk.id || w.route_id !== walk.route_id || w.validation_status === 'flagged')
      continue;
    const wt = new Date(w.start_time).getTime();
    if (wt < t && (!best || wt > new Date(best.start_time).getTime())) best = w;
  }
  return best;
}

export function parseTrack(geojson: string | null | undefined): LL[] {
  if (!geojson) return [];
  try {
    const g = JSON.parse(geojson) as { type: string; coordinates: LL[] };
    return g.type === 'LineString' ? g.coordinates : [];
  } catch {
    return [];
  }
}

/** Reorder a closed loop so that vertex i becomes the start. */
export function rotateLoop(coords: LL[], i: number): LL[] {
  const open = coords.slice(0, -1);
  const r = [...open.slice(i), ...open.slice(0, i)];
  return [...r, r[0]];
}

/** Initial bearing of a segment, degrees clockwise from north. */
export function bearing(a: LL, b: LL) {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassName = (deg: number) => COMPASS[Math.round(deg / 45) % 8];
