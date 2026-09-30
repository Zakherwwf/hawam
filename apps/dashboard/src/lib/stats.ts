import type { Sighting, Walk } from '../data/api.ts';
import { weekStart } from './geo.ts';

export type Range = '30d' | '90d' | '12m' | 'all';

export function rangeStart(range: Range, now = new Date()): Date | null {
  if (range === 'all') return null;
  const d = new Date(now);
  if (range === '30d') d.setDate(d.getDate() - 30);
  else if (range === '90d') d.setDate(d.getDate() - 90);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

export const isStructured = (w: Walk) => w.protocol !== 'incidental';
export const isComplete = (w: Walk) => isStructured(w) && w.complete_session && w.end_time != null;

/**
 * Headline effort figures. Flagged walks are counted separately and left out
 * of effort, the same rule as the leaderboards (CLAUDE.md 2.2).
 */
export function overview(walks: Walk[], sightings: Sighting[], since: Date | null) {
  const inRange = (iso: string) => !since || new Date(iso) >= since;
  const w = walks.filter((x) => inRange(x.start_time));
  const s = sightings.filter((x) => inRange(x.observed_at));
  const counted = w.filter((x) => x.validation_status !== 'flagged');
  const structured = counted.filter(isStructured);
  const withAnimals = new Set(s.map((x) => x.session_id));
  const complete = structured.filter(isComplete);
  const animals = (sp?: string) =>
    s.filter((x) => !sp || x.species === sp).reduce((a, x) => a + (x.group_size || 1), 0);
  return {
    walks: structured.length,
    km: structured.reduce((a, x) => a + (x.distance_km ?? 0), 0),
    minutes: structured.reduce((a, x) => a + (x.duration_min ?? 0), 0),
    complete: complete.length,
    zero: complete.filter((x) => !withAnimals.has(x.id)).length,
    sightings: s.length,
    animals: animals(),
    cats: animals('cat'),
    dogs: animals('dog'),
    volunteers: new Set(w.map((x) => x.observer_id)).size,
    flagged: w.filter((x) => x.validation_status === 'flagged').length,
    quick: counted.filter((x) => x.protocol === 'incidental').length,
  };
}

/** Kilometres and walks per week for the last n weeks, oldest first. */
export function weekly(walks: Walk[], n: number, now = new Date()) {
  const current = weekStart(now).getTime();
  const out = Array.from({ length: n }, (_, i) => {
    const start = new Date(current);
    start.setDate(start.getDate() - (n - 1 - i) * 7);
    return { start, km: 0, walks: 0 };
  });
  for (const w of walks) {
    if (!isStructured(w) || w.validation_status === 'flagged') continue;
    const ws = weekStart(new Date(w.start_time)).getTime();
    const slot = out.find((o) => o.start.getTime() === ws);
    if (slot) {
      slot.km += w.distance_km ?? 0;
      slot.walks += 1;
    }
  }
  return out;
}

/** Animals and sightings per walk, keyed by session id. */
export function perWalk(sightings: Sighting[]) {
  const m = new Map<string, { sightings: number; animals: number }>();
  for (const s of sightings) {
    const v = m.get(s.session_id) ?? { sightings: 0, animals: 0 };
    v.sightings += 1;
    v.animals += s.group_size || 1;
    m.set(s.session_id, v);
  }
  return m;
}

export const REASON_LABEL: Record<string, string> = {
  mock_location: 'Fake GPS',
  vehicle_speed: 'Vehicle speed',
  teleport: 'GPS jump',
  average_speed: 'Too fast on average',
  implausible_density: 'Implausible count',
};

export const PROTOCOL_LABEL: Record<string, string> = {
  transect: 'Survey walk',
  stationary_point: 'Point count',
  incidental: 'Quick sighting',
};

export const WEATHER_LABEL: Record<string, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  rain: 'Rain',
  wind: 'Windy',
};
export const TIME_OF_DAY_LABEL: Record<string, string> = {
  dawn: 'Dawn',
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  dusk: 'Dusk',
  night: 'Night',
};
