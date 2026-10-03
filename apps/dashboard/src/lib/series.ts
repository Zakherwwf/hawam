import type { Sighting, Walk } from '../data/api.ts';
import { weekStart } from './geo.ts';

/**
 * Time series for the trend charts and the Explore builder. Every metric is
 * computed from walks and sightings already filtered by lib/filters, so the
 * charts, the stat tiles and the tables always agree.
 *
 * Effort metrics leave flagged walks out (CLAUDE.md 2.2). Counts of animals
 * are reported, never turned into population estimates (CLAUDE.md 1.1):
 * the encounter rate is animals seen per km walked, an index of effort, not
 * a density.
 */
export type Grain = 'day' | 'week' | 'month';

export type MetricId =
  | 'km'
  | 'minutes'
  | 'walks'
  | 'complete'
  | 'zero'
  | 'sightings'
  | 'animals'
  | 'rate'
  | 'volunteers'
  | 'flagged'
  | 'welfare'
  | 'bcs';

export interface MetricDef {
  id: MetricId;
  label: string;
  unit: string;
  /** How buckets combine for the summary: sum, or a ratio recomputed from parts */
  kind: 'sum' | 'ratio' | 'distinct' | 'mean';
  help: string;
  decimals: number;
}

export const METRICS: MetricDef[] = [
  {
    id: 'km',
    label: 'Kilometres surveyed',
    unit: 'km',
    kind: 'sum',
    decimals: 1,
    help: 'Distance walked on survey walks, flagged walks excluded.',
  },
  {
    id: 'minutes',
    label: 'Survey time',
    unit: 'min',
    kind: 'sum',
    decimals: 0,
    help: 'Minutes of survey walks and point counts, flagged excluded.',
  },
  {
    id: 'walks',
    label: 'Survey sessions',
    unit: '',
    kind: 'sum',
    decimals: 0,
    help: 'Survey walks and point counts, flagged excluded.',
  },
  {
    id: 'complete',
    label: 'Complete checklists',
    unit: '',
    kind: 'sum',
    decimals: 0,
    help: 'Sessions where every cat and dog seen was recorded.',
  },
  {
    id: 'zero',
    label: 'Zero-animal checklists',
    unit: '',
    kind: 'sum',
    decimals: 0,
    help: 'Complete checklists with no animals: recorded absences.',
  },
  {
    id: 'sightings',
    label: 'Sightings',
    unit: '',
    kind: 'sum',
    decimals: 0,
    help: 'Records, one per animal or group.',
  },
  {
    id: 'animals',
    label: 'Animals counted',
    unit: '',
    kind: 'sum',
    decimals: 0,
    help: 'Summed group sizes. A count, not a population estimate.',
  },
  {
    id: 'rate',
    label: 'Encounter rate',
    unit: 'per km',
    kind: 'ratio',
    decimals: 2,
    help: 'Animals counted on complete survey walks divided by km walked on them. An effort-corrected index, not a density.',
  },
  {
    id: 'volunteers',
    label: 'Active volunteers',
    unit: '',
    kind: 'distinct',
    decimals: 0,
    help: 'People who recorded at least one session.',
  },
  {
    id: 'flagged',
    label: 'Flagged sessions',
    unit: '',
    kind: 'sum',
    decimals: 0,
    help: 'Sessions the server checks flagged (speed, fake GPS, jumps, duplicates).',
  },
  {
    id: 'welfare',
    label: 'Welfare alerts',
    unit: '',
    kind: 'sum',
    decimals: 0,
    help: 'Sightings marked as needing welfare attention.',
  },
  {
    id: 'bcs',
    label: 'Mean body condition',
    unit: '/5',
    kind: 'mean',
    decimals: 2,
    help: 'Mean ICAM body condition score where it was assessed (1 very thin, 5 obese).',
  },
];
export const metricDef = (id: MetricId) => METRICS.find((m) => m.id === id)!;

export function bucketStart(d: Date, grain: Grain): Date {
  if (grain === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (grain === 'week') return weekStart(d);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function nextBucket(d: Date, grain: Grain): Date {
  const n = new Date(d);
  if (grain === 'day') n.setDate(n.getDate() + 1);
  else if (grain === 'week') n.setDate(n.getDate() + 7);
  else n.setMonth(n.getMonth() + 1);
  return n;
}

/** Every bucket from..to, so empty periods show as zero rather than vanish. */
export function buckets(from: Date, to: Date, grain: Grain): Date[] {
  const out: Date[] = [];
  let d = bucketStart(from, grain);
  let guard = 0;
  while (d < to && guard++ < 2000) {
    out.push(d);
    d = nextBucket(d, grain);
  }
  return out;
}

export function autoGrain(from: Date, to: Date): Grain {
  const days = (to.getTime() - from.getTime()) / 86400000;
  return days <= 45 ? 'day' : days <= 400 ? 'week' : 'month';
}

const counted = (w: Walk) => w.validation_status !== 'flagged';
const structured = (w: Walk) => w.protocol !== 'incidental';

interface Acc {
  km: number;
  minutes: number;
  walks: number;
  complete: number;
  zero: number;
  sightings: number;
  animals: number;
  rateAnimals: number;
  rateKm: number;
  volunteers: Set<string>;
  flagged: number;
  welfare: number;
  bcsSum: number;
  bcsN: number;
}
const empty = (): Acc => ({
  km: 0,
  minutes: 0,
  walks: 0,
  complete: 0,
  zero: 0,
  sightings: 0,
  animals: 0,
  rateAnimals: 0,
  rateKm: 0,
  volunteers: new Set(),
  flagged: 0,
  welfare: 0,
  bcsSum: 0,
  bcsN: 0,
});

export function finish(a: Acc, m: MetricId): number | null {
  switch (m) {
    case 'rate':
      return a.rateKm > 0 ? a.rateAnimals / a.rateKm : null;
    case 'volunteers':
      return a.volunteers.size;
    case 'bcs':
      return a.bcsN ? a.bcsSum / a.bcsN : null;
    default:
      return a[m];
  }
}

function accumulate(
  walks: Walk[],
  sightings: Sighting[],
  keyOf: (iso: string, w?: Walk, s?: Sighting) => string[]
) {
  const map = new Map<string, Acc>();
  const get = (k: string) => {
    let a = map.get(k);
    if (!a) map.set(k, (a = empty()));
    return a;
  };
  const byWalk = new Map<string, Sighting[]>();
  for (const s of sightings) {
    const l = byWalk.get(s.session_id);
    if (l) l.push(s);
    else byWalk.set(s.session_id, [s]);
  }
  for (const w of walks) {
    const keys = keyOf(w.start_time, w);
    const mine = byWalk.get(w.id) ?? [];
    for (const k of keys) {
      const a = get(k);
      a.volunteers.add(w.observer_id);
      if (!counted(w)) {
        a.flagged += 1;
        continue;
      }
      if (structured(w)) {
        a.walks += 1;
        a.minutes += w.duration_min ?? 0;
        if (w.protocol === 'transect') a.km += w.distance_km ?? 0;
        if (w.complete_session && w.end_time) {
          a.complete += 1;
          if (!mine.length) a.zero += 1;
          if (w.protocol === 'transect' && (w.distance_km ?? 0) > 0) {
            a.rateKm += w.distance_km ?? 0;
            a.rateAnimals += mine.reduce((n, s) => n + (s.group_size || 1), 0);
          }
        }
      }
    }
  }
  const walkById = new Map(walks.map((w) => [w.id, w]));
  for (const s of sightings) {
    const w = walkById.get(s.session_id);
    if (w && !counted(w)) continue;
    for (const k of keyOf(s.observed_at, w, s)) {
      const a = get(k);
      a.sightings += 1;
      a.animals += s.group_size || 1;
      if (s.is_welfare_alert) a.welfare += 1;
      if (s.body_condition_score != null) {
        a.bcsSum += s.body_condition_score;
        a.bcsN += 1;
      }
    }
  }
  return map;
}

export interface Point {
  t: Date;
  v: number | null;
}

/** One metric over time. */
export function series(
  walks: Walk[],
  sightings: Sighting[],
  metric: MetricId,
  from: Date,
  to: Date,
  grain: Grain
): Point[] {
  const keys = buckets(from, to, grain);
  const k = (iso: string) => [String(bucketStart(new Date(iso), grain).getTime())];
  const acc = accumulate(walks, sightings, k);
  return keys.map((t) => {
    const a = acc.get(String(t.getTime()));
    return { t, v: a ? finish(a, metric) : metric === 'rate' || metric === 'bcs' ? null : 0 };
  });
}

/** Totals for a whole window, combined the right way for each metric. */
export function total(walks: Walk[], sightings: Sighting[], metric: MetricId): number | null {
  const acc = accumulate(walks, sightings, () => ['all']).get('all');
  return acc ? finish(acc, metric) : metric === 'rate' || metric === 'bcs' ? null : 0;
}

export type Breakdown =
  'none' | 'species' | 'protocol' | 'route' | 'volunteer' | 'time_of_day' | 'weather';
export const BREAKDOWNS: { value: Breakdown; label: string }[] = [
  { value: 'none', label: 'Nothing' },
  { value: 'species', label: 'Species' },
  { value: 'protocol', label: 'Record type' },
  { value: 'route', label: 'Route' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'time_of_day', label: 'Time of day' },
  { value: 'weather', label: 'Weather' },
];

/**
 * One metric over time, split into groups. Species splits only the
 * sighting-side metrics; walk metrics are not split by species (a walk is
 * effort for every species at once).
 */
export function splitSeries(
  walks: Walk[],
  sightings: Sighting[],
  metric: MetricId,
  from: Date,
  to: Date,
  grain: Grain,
  by: Breakdown,
  labelOf: (key: string) => string,
  maxGroups = 6
): { key: string; label: string; points: Point[]; total: number | null }[] {
  if (by === 'none')
    return [
      {
        key: 'all',
        label: metricDef(metric).label,
        points: series(walks, sightings, metric, from, to, grain),
        total: total(walks, sightings, metric),
      },
    ];
  const walkById = new Map(walks.map((w) => [w.id, w]));
  const groupOf = (w?: Walk, s?: Sighting): string => {
    const ww = w ?? (s ? walkById.get(s.session_id) : undefined);
    switch (by) {
      case 'species':
        return s?.species ?? 'all';
      case 'protocol':
        return ww?.protocol ?? 'unknown';
      case 'route':
        return ww?.route_id ?? 'none';
      case 'volunteer':
        return ww?.observer_id ?? 'unknown';
      case 'time_of_day':
        return ww?.time_of_day ?? 'unrecorded';
      case 'weather':
        return ww?.weather ?? 'unrecorded';
    }
    return 'all';
  };
  const keys = buckets(from, to, grain);
  const acc = accumulate(walks, sightings, (iso, w, s) => {
    const g = groupOf(w, s);
    return [`${g}|${bucketStart(new Date(iso), grain).getTime()}`, `${g}|all`];
  });
  const groups = new Map<string, number>();
  for (const [k, a] of acc) {
    const [g, b] = k.split('|');
    if (b !== 'all' || (by === 'species' && g === 'all')) continue;
    groups.set(g, finish(a, metric) ?? 0);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, maxGroups).map(([g]) => ({
    key: g,
    label: labelOf(g),
    total: acc.get(`${g}|all`) ? finish(acc.get(`${g}|all`)!, metric) : null,
    points: keys.map((t) => {
      const a = acc.get(`${g}|${t.getTime()}`);
      return { t, v: a ? finish(a, metric) : metric === 'rate' || metric === 'bcs' ? null : 0 };
    }),
  }));
}

/** Least-squares line through the non-null points; slope per bucket. */
export function linearTrend(points: Point[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  points.forEach((p, i) => {
    if (p.v != null) {
      xs.push(i);
      ys.push(p.v);
    }
  });
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (!sxx) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, intercept, r2, at: (i: number) => intercept + slope * i };
}

/** Trailing moving average over k buckets, nulls skipped. */
export function rolling(points: Point[], k: number): Point[] {
  return points.map((p, i) => {
    const win = points.slice(Math.max(0, i - k + 1), i + 1).filter((x) => x.v != null);
    return {
      t: p.t,
      v: win.length ? win.reduce((a, x) => a + (x.v as number), 0) / win.length : null,
    };
  });
}

/** Signed change between two windows, as a fraction; null when undefined. */
export function delta(cur: number | null, prev: number | null) {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}

/** Day-by-day counts for the calendar heatmap: sessions per local day. */
export function dailyCounts(walks: Walk[]) {
  const m = new Map<string, { walks: number; km: number }>();
  for (const w of walks) {
    if (!counted(w)) continue;
    const d = new Date(w.start_time);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const v = m.get(k) ?? { walks: 0, km: 0 };
    v.walks += 1;
    v.km += w.distance_km ?? 0;
    m.set(k, v);
  }
  return m;
}
export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Hour-of-day by weekday activity matrix (sessions started). */
export function hourWeekday(walks: Walk[]) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const w of walks) {
    if (!counted(w)) continue;
    const d = new Date(w.start_time);
    grid[(d.getDay() + 6) % 7][d.getHours()] += 1;
  }
  return grid;
}

/** Histogram of a numeric field into fixed-width bins. */
export function histogram(values: number[], width: number, max?: number) {
  const top = max ?? Math.max(width, ...values);
  const n = Math.max(1, Math.ceil(top / width));
  const bins = Array.from({ length: n }, (_, i) => ({
    from: i * width,
    to: (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const i = Math.min(n - 1, Math.max(0, Math.floor(v / width)));
    bins[i].count += 1;
  }
  return bins;
}
