import type { Sighting, Walk } from '../data/api.ts';
import { isComplete } from './stats.ts';

const usable = (w: Walk) => w.validation_status !== 'flagged';

/**
 * Survey effort, one row per session: the effort metadata occupancy and
 * N-mixture models need, including complete sessions with zero detections.
 */
export function effortRows(walks: Walk[], sightings: Sighting[]) {
  const n = new Map<string, { detections: number; animals: number }>();
  for (const s of sightings) {
    const v = n.get(s.session_id) ?? { detections: 0, animals: 0 };
    v.detections += 1;
    v.animals += s.group_size || 1;
    n.set(s.session_id, v);
  }
  return walks.map((w) => ({
    session_id: w.id,
    observer_id: w.observer_id,
    protocol: w.protocol,
    route_id: w.route_id ?? '',
    start_time: w.start_time,
    end_time: w.end_time ?? '',
    duration_min: w.duration_min ?? '',
    distance_km: w.protocol === 'transect' ? (w.distance_km ?? '') : '',
    complete_checklist: w.protocol === 'incidental' ? '' : w.complete_session,
    number_of_observers: w.number_of_observers,
    weather: w.weather ?? '',
    time_of_day: w.time_of_day ?? '',
    country_code: w.country_code ?? '',
    detections: n.get(w.id)?.detections ?? 0,
    animals: n.get(w.id)?.animals ?? 0,
    validation_status: w.validation_status,
    validation_reasons: w.validation_reasons,
  }));
}

/**
 * Distance sampling, in the flat format of the R Distance package: one row
 * per detection with its perpendicular distance, plus one row with an empty
 * distance for each complete transect without detections, so its effort
 * still counts. Only complete, unflagged transects; detections without a
 * distance estimate are left out rather than guessed.
 */
export function distanceRows(walks: Walk[], sightings: Sighting[]) {
  const transects = walks.filter(
    (w) => w.protocol === 'transect' && isComplete(w) && usable(w) && (w.distance_km ?? 0) > 0
  );
  const bySession = new Map<string, Sighting[]>();
  for (const s of sightings)
    bySession.set(s.session_id, [...(bySession.get(s.session_id) ?? []), s]);
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const w of transects) {
    const dets = bySession.get(w.id) ?? [];
    const measured = dets.filter((d) => d.perpendicular_distance_m != null);
    skipped += dets.length - measured.length;
    const base = {
      'Region.Label': w.country_code ?? 'all',
      Area: 0,
      'Sample.Label': w.id,
      Effort: w.distance_km,
    };
    if (measured.length === 0)
      rows.push({ ...base, object: '', distance: '', size: '', species: '' });
    for (const d of measured)
      rows.push({
        ...base,
        object: d.public_code,
        distance: Math.round((d.perpendicular_distance_m as number) * 10) / 10,
        size: d.group_size,
        species: d.species,
      });
  }
  return { rows, transects: transects.length, skipped };
}

/** Exact positions, for researchers only; the download is logged as precise. */
export function preciseRows(sightings: Sighting[]) {
  return sightings.map((s) => ({
    code: s.public_code,
    observation_id: s.id,
    session_id: s.session_id,
    observed_at: s.observed_at,
    species: s.species,
    group_size: s.group_size,
    latitude: s.latitude,
    longitude: s.longitude,
    protocol: s.protocol,
    perpendicular_distance_m: s.perpendicular_distance_m ?? '',
    body_condition_score: s.body_condition_score ?? '',
    sex: s.sex ?? '',
    age_class: s.age_class ?? '',
    ear_tip_or_notch: s.ear_tip_or_notch ?? '',
  }));
}
