/**
 * Pure helpers for the survey walk screen (tested in walkMath.test.ts).
 */

import { XP_WEIGHTS } from '../gamification/progress.ts';

/** Distances offered as one-tap estimates, in metres. */
export const DISTANCE_CHIPS = [2, 5, 10, 20, 50] as const;

export type Side = 'left' | 'ahead' | 'right' | 'behind';

/** Compass bearing to the animal from the walking heading and the side it was on. */
export function bearingFromSide(headingDeg: number, side: Side): number {
  const offset = { ahead: 0, right: 90, behind: 180, left: 270 }[side];
  return Math.round((((headingDeg + offset) % 360) + 360) % 360);
}

/**
 * What the server will award for this walk, as far as the phone can tell
 * (xp_weights in 20260924000200_gamification.sql). New 1 km cells are left
 * out: only the server knows which cells are new to this observer.
 */
export function surveyXpPreview({
  km,
  observations,
}: {
  km: number;
  observations: { group_size: number; hasPhoto: boolean }[];
}): { total: number; parts: { key: 'session' | 'km' | 'sightings' | 'photos'; xp: number }[] } {
  const animals = observations.reduce((a, o) => a + Math.max(1, o.group_size), 0);
  const parts = [
    { key: 'session' as const, xp: XP_WEIGHTS.completedSession },
    { key: 'km' as const, xp: Math.floor(km) * XP_WEIGHTS.kilometre },
    {
      key: 'sightings' as const,
      xp:
        observations.length * XP_WEIGHTS.observation +
        Math.max(0, animals - observations.length) * XP_WEIGHTS.extraAnimal,
    },
    {
      key: 'photos' as const,
      xp: observations.filter((o) => o.hasPhoto).length * XP_WEIGHTS.photo,
    },
  ];
  return { total: parts.reduce((a, p) => a + p.xp, 0), parts };
}

function metres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Tags the volunteer already gave to animals of this species near here,
 * nearest first: "seen this one before?" suggestions for resightings.
 */
export function nearbyTags(
  sightings: { species: string; identifier?: string; latitude: number; longitude: number }[],
  species: string,
  lat: number,
  lon: number,
  radiusM = 350,
  limit = 4
): string[] {
  const best = new Map<string, number>();
  for (const s of sightings) {
    const tag = s.identifier?.trim();
    if (!tag || s.species !== species) continue;
    // Server codes (CAT-000123) name records, not animals
    if (/^(CAT|DOG|OBS)-\d+$/.test(tag)) continue;
    const d = metres(lat, lon, s.latitude, s.longitude);
    if (d <= radiusM && d < (best.get(tag) ?? Infinity)) best.set(tag, d);
  }
  return [...best.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([t]) => t);
}
