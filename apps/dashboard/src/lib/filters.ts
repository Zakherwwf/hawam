import type { Sighting, Walk } from '../data/api.ts';

/**
 * One filter model for the whole portal (Metabase-style dashboard filters).
 * Every value lives in the URL, so a filtered view is a shareable link, and
 * every chart, stat and table below the filter bar reads the same slice.
 */
export type RangePreset = '7d' | '30d' | '90d' | '6m' | '12m' | 'all' | 'custom';
export type SpeciesFilter = 'cat' | 'dog' | 'unknown';
export type ProtoFilter = 'transect' | 'stationary_point' | 'incidental';
export type StatusFilter = 'valid' | 'flagged' | 'complete' | 'partial';

export interface Filters {
  range: RangePreset;
  from: Date | null;
  /** Exclusive end */
  to: Date | null;
  species: SpeciesFilter[];
  protocol: ProtoFilter | null;
  status: StatusFilter | null;
  who: string | null;
  route: string | null;
}

export const RANGE_LABEL: Record<RangePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  all: 'All time',
  custom: 'Custom range',
};

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function presetStart(range: RangePreset, now = new Date()): Date | null {
  const d = dayStart(now);
  switch (range) {
    case '7d':
      d.setDate(d.getDate() - 6);
      return d;
    case '30d':
      d.setDate(d.getDate() - 29);
      return d;
    case '90d':
      d.setDate(d.getDate() - 89);
      return d;
    case '6m':
      d.setMonth(d.getMonth() - 6);
      return d;
    case '12m':
      d.setFullYear(d.getFullYear() - 1);
      return d;
    default:
      return null;
  }
}

/** yyyy-mm-dd in local time, for URLs and date inputs */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDay = (s: string | null) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function readFilters(
  p: URLSearchParams,
  fallback: RangePreset = '90d',
  now = new Date()
): Filters {
  const from = parseDay(p.get('from'));
  const toDay = parseDay(p.get('to'));
  const custom = !!(from || toDay);
  const range = custom ? 'custom' : (p.get('range') as RangePreset) || fallback;
  const to = toDay ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1) : null;
  return {
    range,
    from: custom ? from : presetStart(range, now),
    to,
    species: (p.get('sp') ?? '')
      .split(',')
      .filter((s): s is SpeciesFilter => s === 'cat' || s === 'dog' || s === 'unknown'),
    protocol: (p.get('proto') as ProtoFilter) || null,
    status: (p.get('status') as StatusFilter) || null,
    who: p.get('who'),
    route: p.get('route'),
  };
}

export function activeCount(f: Filters) {
  return (
    (f.species.length ? 1 : 0) +
    (f.protocol ? 1 : 0) +
    (f.status ? 1 : 0) +
    (f.who ? 1 : 0) +
    (f.route ? 1 : 0)
  );
}

const inWindow = (iso: string, f: Pick<Filters, 'from' | 'to'>) => {
  const t = new Date(iso).getTime();
  return (!f.from || t >= f.from.getTime()) && (!f.to || t < f.to.getTime());
};

export function walkMatches(w: Walk, f: Filters, opts: { ignoreDates?: boolean } = {}) {
  if (!opts.ignoreDates && !inWindow(w.start_time, f)) return false;
  if (f.protocol && w.protocol !== f.protocol) return false;
  if (f.who && w.observer_id !== f.who) return false;
  if (f.route && w.route_id !== f.route) return false;
  if (f.status === 'flagged' && w.validation_status !== 'flagged') return false;
  if (f.status === 'valid' && w.validation_status === 'flagged') return false;
  if (f.status === 'complete' && !(w.complete_session && w.protocol !== 'incidental')) return false;
  if (f.status === 'partial' && (w.complete_session || w.protocol === 'incidental')) return false;
  return true;
}

/**
 * Apply the filters to both tables at once. Sightings follow their walk
 * (a sighting on a flagged walk goes with it), then the species filter.
 * Walks are NOT dropped by the species filter: a walk with no cats is still
 * effort for cats, and dropping it would turn absences into missing data.
 */
export function applyFilters(
  walks: Walk[],
  sightings: Sighting[],
  f: Filters,
  opts: { ignoreDates?: boolean } = {}
) {
  const w = walks.filter((x) => walkMatches(x, f, opts));
  const ids = new Set(w.map((x) => x.id));
  const s = sightings.filter(
    (x) => ids.has(x.session_id) && (!f.species.length || f.species.includes(x.species))
  );
  return { walks: w, sightings: s };
}

/** The same-length window just before the current one, for deltas. */
export function previousWindow(f: Filters, now = new Date()): Pick<Filters, 'from' | 'to'> | null {
  if (!f.from) return null;
  const end = f.to ?? new Date(dayStart(now).getTime() + 86400000);
  const len = end.getTime() - f.from.getTime();
  return { from: new Date(f.from.getTime() - len), to: new Date(f.from.getTime()) };
}

export function describeFilters(f: Filters, names: { who?: string; route?: string } = {}) {
  const parts: string[] = [];
  if (f.species.length) parts.push(f.species.join(' and '));
  if (f.protocol) parts.push(f.protocol.replace('_', ' '));
  if (f.status) parts.push(f.status);
  if (f.who) parts.push(names.who ?? 'one volunteer');
  if (f.route) parts.push(names.route ?? 'one route');
  return parts.join(', ');
}
