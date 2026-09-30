/**
 * Known individual animals, as the server knows them (individuals_app), kept
 * on the phone so the "seen before?" strip works offline. Pure helpers are
 * tested in knownAnimals.test.ts.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CoatPattern =
  'tabby' | 'bicolour_piebald' | 'tortoiseshell_calico' | 'solid_black' | 'solid_other' | 'other';
export const COAT_PATTERNS: CoatPattern[] = [
  'tabby',
  'bicolour_piebald',
  'tortoiseshell_calico',
  'solid_black',
  'solid_other',
  'other',
];

export interface KnownAnimal {
  id: string;
  species: 'cat' | 'dog' | 'unknown';
  nickname: string | null;
  coatPattern: CoatPattern | null;
  latitude: number | null;
  longitude: number | null;
  photoPath: string | null;
  hasLeftFlank: boolean;
  hasRightFlank: boolean;
  sightings: number;
  lastSeen: string | null;
  createdBy: string | null;
}

/** What the volunteer decided for one sighting. */
export type AnimalLink =
  | { kind: 'none' }
  | { kind: 'same'; id: string; decision: 'same' | 'unsure' }
  | { kind: 'new'; id: string; nickname?: string; coatPattern?: CoatPattern };

export interface IndividualRow {
  id: string;
  species: 'cat' | 'dog' | 'unknown';
  nickname: string | null;
  coat_pattern: CoatPattern | null;
  created_by: string | null;
  last_seen: string | null;
  sightings_count: number;
  latitude: number | null;
  longitude: number | null;
  photo_path: string | null;
  has_left_flank: boolean;
  has_right_flank: boolean;
}

export function animalFromServer(r: IndividualRow): KnownAnimal {
  return {
    id: r.id,
    species: r.species,
    nickname: r.nickname,
    coatPattern: r.coat_pattern,
    latitude: r.latitude,
    longitude: r.longitude,
    photoPath: r.photo_path,
    hasLeftFlank: r.has_left_flank,
    hasRightFlank: r.has_right_flank,
    sightings: r.sightings_count,
    lastSeen: r.last_seen,
    createdBy: r.created_by,
  };
}

function metres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Known animals of this species within radius, nearest first. */
export function nearbyAnimals(
  animals: KnownAnimal[],
  species: string,
  lat: number,
  lon: number,
  radiusM = 300,
  limit = 6
): (KnownAnimal & { distanceM: number })[] {
  return animals
    .filter((a) => a.species === species && a.latitude != null && a.longitude != null)
    .map((a) => ({
      ...a,
      distanceM: metres(lat, lon, a.latitude as number, a.longitude as number),
    }))
    .filter((a) => a.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

/** The flank still missing for this animal, to ask for it (option A). */
export function missingFlank(
  a: Pick<KnownAnimal, 'hasLeftFlank' | 'hasRightFlank'>
): 'left_flank' | 'right_flank' | null {
  if (!a.hasLeftFlank) return 'left_flank';
  if (!a.hasRightFlank) return 'right_flank';
  return null;
}

/** The observation's "individual" block for submit_survey_bundle. */
export function linkPayload(link: AnimalLink | undefined) {
  if (!link || link.kind === 'none') return undefined;
  if (link.kind === 'new')
    return {
      id: link.id,
      new: true,
      nickname: link.nickname?.trim() || undefined,
      coat_pattern: link.coatPattern,
    };
  return { id: link.id, decision: link.decision };
}

interface State {
  animals: KnownAnimal[];
  load: () => Promise<void>;
  replace: (animals: KnownAnimal[]) => void;
}

const KEY = 'hawem_known_animals_v1';

export const useKnownAnimals = create<State>((set) => ({
  animals: [],
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ animals: JSON.parse(raw) });
    } catch {
      // Nothing cached yet
    }
  },
  replace: (animals) => {
    set({ animals });
    AsyncStorage.setItem(KEY, JSON.stringify(animals)).catch(() => {});
  },
}));
