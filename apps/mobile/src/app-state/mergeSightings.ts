import type { SightingItem } from './types';
import type { MapObservationRow } from '../services/supabase';

/** A server observation as the screens display it. */
export function sightingFromRow(row: MapObservationRow): SightingItem | null {
  if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return null;
  return {
    id: row.id,
    species: row.species === 'unknown' ? ('unknown' as SightingItem['species']) : row.species,
    group_size: row.group_size ?? 1,
    distance_from_path_m: row.perpendicular_distance_m ?? undefined,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    observed_at: row.observed_at,
    body_condition_score: row.body_condition_score ?? undefined,
    protocol: row.protocol,
    notes: row.notes ?? undefined,
    observer_name: row.observer_name ?? undefined,
    publicCode: row.public_code,
    syncPending: false,
  };
}

/**
 * The phone's own sightings, labelled with the server code once synced.
 * Local fields (photos, the observer's tag) are kept.
 */
export function labelOwnSightings(
  local: SightingItem[],
  remote: MapObservationRow[]
): SightingItem[] {
  const codes = new Map(remote.map((r) => [r.id, r.public_code]));
  return local.map((s) => {
    const code = codes.get(s.id);
    return { ...s, publicCode: code, syncPending: !code };
  });
}

/**
 * Everyone's observations for the shared map: every server row, plus this
 * phone's sightings that have not reached the server yet. A synced local
 * sighting appears once, from the server, with its code.
 */
export function mergeForMap(local: SightingItem[], remote: MapObservationRow[]): SightingItem[] {
  const fromServer = remote.map(sightingFromRow).filter((s): s is SightingItem => s !== null);
  const serverIds = new Set(fromServer.map((s) => s.id));
  const pending = local
    .filter((s) => !serverIds.has(s.id))
    .map((s) => ({ ...s, publicCode: undefined, syncPending: true }));
  return [...pending, ...fromServer];
}
