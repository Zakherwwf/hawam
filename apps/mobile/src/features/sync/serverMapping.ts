/**
 * Rows from the server views (routes_app, colonies_app) to the app's models
 * and back. Pure, so the rules are tested without a network.
 */

import type { FixedRoute } from '../routes/routesStore.ts';
import type { CatColony, ColonySpecies } from '../colonies/coloniesStore.ts';

export interface RouteRow {
  id: string;
  name: string;
  governorate?: string | null;
  delegation?: string | null;
  habitat_notes?: string | null;
  length_km?: number | null;
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  // Walking protocol (route_protocols migration)
  direction_rule?: 'as_drawn' | 'either' | null;
  side_rule?: 'both' | 'left' | 'right' | null;
  strip_width_m?: number | null;
  window_start?: string | null;
  window_end?: string | null;
  require_complete?: boolean | null;
  instructions?: string | null;
  version?: number | null;
}

/** Server route (GeoJSON lon, lat) to the app's route (lat, lon), keeping what this phone knows. */
export function routeFromServer(row: RouteRow, local?: FixedRoute): FixedRoute | null {
  const coords = row.geometry?.type === 'LineString' ? row.geometry.coordinates : [];
  if (coords.length < 2) return null;
  return {
    id: row.id,
    name: row.name,
    nameAr: local?.nameAr ?? '',
    zone: [row.delegation, row.governorate].filter(Boolean).join(', '),
    distanceKm: Math.round((row.length_km ?? 0) * 100) / 100,
    targetPaceKmH: local?.targetPaceKmH ?? 3.5,
    description: row.habitat_notes ?? '',
    descriptionAr: local?.descriptionAr ?? '',
    waypoints: coords.map(([lon, lat]) => [lat, lon] as [number, number]),
    densityClassification: local?.densityClassification ?? 'medium',
    isAdopted: local?.isAdopted ?? false,
    timesSurveyed: local?.timesSurveyed ?? 0,
    lastSurveyedAt: local?.lastSurveyedAt ?? null,
    bonusXp: 0,
    rules:
      row.direction_rule !== undefined
        ? {
            direction: row.direction_rule ?? 'as_drawn',
            side: row.side_rule ?? 'both',
            stripWidthM: row.strip_width_m ?? null,
            windowStart: row.window_start?.slice(0, 5) ?? null,
            windowEnd: row.window_end?.slice(0, 5) ?? null,
            requireComplete: row.require_complete ?? true,
            instructions: row.instructions ?? null,
            version: row.version ?? 1,
          }
        : undefined,
  };
}

export interface ColonyRow {
  id: string;
  name: string | null;
  species: ColonySpecies | null;
  latitude: number;
  longitude: number;
  estimated_population: number | null;
  sterilised_count: number | null;
  has_water: boolean;
  has_shelter: boolean;
  caretaker_name: string | null;
  feeding_schedule: string | null;
  area: string | null;
  notes: string | null;
  created_by: string | null;
  visit_count: number | null;
  last_visit_at: string | null;
  created_at: string;
}

export function colonyFromServer(row: ColonyRow): CatColony {
  return {
    id: row.id,
    name: row.name ?? '',
    species: row.species ?? 'cat',
    zone: row.area ?? '',
    latitude: row.latitude,
    longitude: row.longitude,
    estimatedPopulation: row.estimated_population ?? 0,
    tnrSterilizedCount: row.sterilised_count ?? 0,
    caretakerName: row.caretaker_name ?? undefined,
    feedingSchedule: row.feeding_schedule ?? undefined,
    hasWaterStation: row.has_water,
    hasShelter: row.has_shelter,
    lastInspectedAt: row.last_visit_at ?? row.created_at,
    inspectionsCount: row.visit_count ?? 0,
    notes: row.notes ?? undefined,
    createdBy: row.created_by ?? undefined,
    synced: true,
  };
}

/** Insert row for public.colonies; the location as EWKT, which PostGIS parses. */
export function colonyToServer(c: CatColony, userId: string) {
  return {
    id: c.id,
    type: c.species === 'dog' ? 'dog_pack_area' : 'cat_colony',
    species: c.species,
    location: `SRID=4326;POINT(${c.longitude} ${c.latitude})`,
    name: c.name || null,
    notes: c.notes ?? null,
    created_by: userId,
    estimated_population: c.estimatedPopulation,
    sterilised_count: c.tnrSterilizedCount,
    has_water: c.hasWaterStation,
    has_shelter: c.hasShelter,
    caretaker_name: c.caretakerName ?? null,
    feeding_schedule: c.feedingSchedule ?? null,
    area: c.zone || null,
  };
}
