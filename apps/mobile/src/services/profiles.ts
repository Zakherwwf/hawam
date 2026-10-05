/**
 * Read-only data for the profile screens (sighting, known animal, person).
 * Everything here is already readable by any signed-in account under RLS;
 * nothing private is fetched: no emails, no other people's GPS tracks.
 * Every function returns null when offline or on error, and the screens
 * fall back to what the phone already knows.
 */
import { supabase } from './supabase';
import {
  PREVIEW_KNOWN_ANIMALS,
  PREVIEW_MODE,
  PREVIEW_PERSON,
  PREVIEW_SIGHTINGS,
} from '../app-state/previewData';

/** Preview mode (dev only): a sighting as the server would return it. */
function previewServerSighting(i: number): ServerSighting {
  const s = PREVIEW_SIGHTINGS[i % PREVIEW_SIGHTINGS.length];
  return {
    id: s.id,
    observed_at: s.observed_at,
    species: s.species,
    group_size: s.group_size,
    latitude: s.latitude,
    longitude: s.longitude,
    observer_latitude: s.latitude - 0.00012,
    observer_longitude: s.longitude - 0.00008,
    bearing_deg: 28,
    distance_estimate_m: 15,
    perpendicular_distance_m: s.distance_from_path_m ?? 7,
    body_condition_score: s.body_condition_score ?? null,
    sex: null,
    age_class: null,
    ear_tip_or_notch: null,
    coat_pattern: null,
    observer_id: i % 2 ? 'preview' : 'u-karim',
    observer_name: i % 2 ? 'Yasmine Ben Salah' : 'Karim Mansour',
    public_code: s.publicCode ?? 'CAT-000000',
    notes: s.notes ?? null,
    exact: i % 2 === 1,
  };
}

export interface ServerSighting {
  id: string;
  observed_at: string;
  species: 'cat' | 'dog' | 'unknown';
  group_size: number;
  latitude: number;
  longitude: number;
  observer_latitude: number | null;
  observer_longitude: number | null;
  bearing_deg: number | null;
  distance_estimate_m: number | null;
  perpendicular_distance_m: number | null;
  body_condition_score: number | null;
  sex: string | null;
  age_class: string | null;
  ear_tip_or_notch: string | null;
  coat_pattern: string | null;
  observer_id: string;
  observer_name: string | null;
  public_code: string;
  notes: string | null;
  /** False when the position is rounded to ~100 m (someone else's sighting) */
  exact: boolean;
}

export interface AnimalLinkRow {
  id: string;
  observation_id: string;
  status: 'proposed' | 'confirmed' | 'rejected';
  decision: 'same' | 'unsure';
  is_founder: boolean;
  created_at: string;
}

export interface PhotoRow {
  observation_id: string;
  storage_path: string;
  angle: 'left_flank' | 'right_flank' | 'face' | 'other';
}

/**
 * Sighting cards come from observation_cards(): exact positions for your own
 * records (and researchers), rounded to ~100 m for other people's, and the
 * observer's standing point only for your own.
 */
async function observationCards(ids: string[]): Promise<ServerSighting[] | null> {
  if (!ids.length) return [];
  const res = await supabase.rpc('observation_cards', { ids });
  if (res.error) return null;
  return (res.data ?? []) as ServerSighting[];
}

/** One uploaded sighting with its geometry, and the known animal it is linked to. */
export async function fetchSightingDetail(
  id: string
): Promise<{
  sighting: ServerSighting | null;
  link: (AnimalLinkRow & { individual_id: string }) | null;
} | null> {
  if (PREVIEW_MODE) {
    const i = Math.max(
      0,
      PREVIEW_SIGHTINGS.findIndex((s) => s.id === id)
    );
    return {
      sighting: previewServerSighting(i),
      link:
        i === 0
          ? {
              id: 'l0',
              observation_id: id,
              individual_id: 'a1',
              status: 'confirmed',
              decision: 'same',
              is_founder: false,
              created_at: PREVIEW_SIGHTINGS[0].observed_at,
            }
          : null,
    };
  }
  try {
    const [cards, l] = await Promise.all([
      observationCards([id]),
      supabase
        .from('individual_links')
        .select('id, observation_id, individual_id, status, decision, is_founder, created_at')
        .eq('observation_id', id)
        .neq('status', 'rejected')
        .limit(1),
    ]);
    if (!cards) return null;
    return {
      sighting: cards[0] ?? null,
      link: (l.data?.[0] as (AnimalLinkRow & { individual_id: string }) | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/** Every sighting linked to a known animal (not rejected), with photos. */
export async function fetchAnimalEncounters(
  individualId: string
): Promise<{ links: AnimalLinkRow[]; sightings: ServerSighting[]; photos: PhotoRow[] } | null> {
  if (PREVIEW_MODE) {
    const a = PREVIEW_KNOWN_ANIMALS.find((x) => x.id === individualId);
    const n = Math.min(4, PREVIEW_SIGHTINGS.length);
    const sightings = Array.from({ length: n }, (_, i) => ({
      ...previewServerSighting(i),
      species: a?.species ?? 'cat',
      latitude: (a?.latitude ?? 36.8024) + (i - 1.5) * 0.0004,
      longitude: (a?.longitude ?? 10.1799) + ((i % 2) - 0.5) * 0.0005,
      observed_at: new Date(Date.now() - (n - i) * 5 * 86400000).toISOString(),
    }));
    return {
      links: sightings.map((s, i) => ({
        id: `l${i}`,
        observation_id: s.id,
        status: i === n - 1 ? 'proposed' : 'confirmed',
        decision: 'same',
        is_founder: i === 0,
        created_at: s.observed_at,
      })),
      sightings,
      photos: [],
    };
  }
  try {
    const l = await supabase
      .from('individual_links')
      .select('id, observation_id, status, decision, is_founder, created_at')
      .eq('individual_id', individualId)
      .neq('status', 'rejected')
      .order('created_at', { ascending: true })
      .limit(500);
    if (l.error) return null;
    const links = (l.data ?? []) as AnimalLinkRow[];
    const ids = links.map((x) => x.observation_id);
    if (!ids.length) return { links, sightings: [], photos: [] };
    const [cards, p] = await Promise.all([
      observationCards(ids),
      supabase
        .from('photos')
        .select('observation_id, storage_path, angle')
        .in('observation_id', ids)
        .is('deleted_at', null)
        .limit(200),
    ]);
    return {
      links,
      sightings: cards ?? [],
      photos: (p.data ?? []) as PhotoRow[],
    };
  } catch {
    return null;
  }
}

export interface PersonProfile {
  id: string;
  displayName: string | null;
  role: 'volunteer' | 'trained_surveyor' | 'researcher' | 'admin';
  memberSince: string | null;
  surveys: number;
  distanceKm: number;
  completeChecklists: number;
  lastSurveyAt: string | null;
  cats: number;
  dogs: number;
  sightings: number;
  coloniesRegistered: number;
  packsRegistered: number;
  coloniesVisited: number;
  packsVisited: number;
}

/** Public figures for one person (people_stats): counts and effort, never locations. */
export async function fetchPersonProfile(userId: string): Promise<PersonProfile | null> {
  if (PREVIEW_MODE) return { id: userId, ...PREVIEW_PERSON };
  try {
    const res = await supabase.from('people_stats').select('*').eq('user_id', userId).maybeSingle();
    if (res.error || !res.data) return null;
    const r = res.data as Record<string, unknown>;
    const n = (k: string) => Number(r[k] ?? 0);
    return {
      id: userId,
      displayName: (r.display_name as string | null) ?? null,
      role: r.role as PersonProfile['role'],
      memberSince: (r.member_since as string | null) ?? null,
      surveys: n('surveys'),
      distanceKm: n('distance_km'),
      completeChecklists: n('complete_checklists'),
      lastSurveyAt: (r.last_survey_at as string | null) ?? null,
      cats: n('cats_counted'),
      dogs: n('dogs_counted'),
      sightings: n('sightings'),
      coloniesRegistered: n('colonies_registered'),
      packsRegistered: n('packs_registered'),
      coloniesVisited: n('colonies_visited'),
      packsVisited: n('packs_visited'),
    };
  } catch {
    return null;
  }
}
