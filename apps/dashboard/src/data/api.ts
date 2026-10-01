import { supabase } from './client';
import { loadPreview, PREVIEW } from './flags';

export type Role = 'volunteer' | 'trained_surveyor' | 'researcher' | 'admin';

export interface Me {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
}

export interface Walk {
  id: string;
  observer_id: string;
  protocol: 'transect' | 'stationary_point' | 'incidental';
  start_time: string;
  end_time: string | null;
  duration_min: number | null;
  distance_km: number | null;
  complete_session: boolean;
  number_of_observers: number;
  weather: string | null;
  time_of_day: string | null;
  validation_status: 'pending' | 'valid' | 'flagged';
  validation_reasons: string[];
  country_code: string | null;
  route_id: string | null;
  observer: { display_name: string | null } | null;
}

export interface Sighting {
  id: string;
  session_id: string;
  observed_at: string;
  species: 'cat' | 'dog' | 'unknown';
  group_size: number;
  latitude: number;
  longitude: number;
  observer_id: string;
  observer_name: string | null;
  protocol: string;
  public_code: string;
  body_condition_score: number | null;
  sex: string | null;
  age_class: string | null;
  ear_tip_or_notch: string | null;
  is_welfare_alert: boolean | null;
  perpendicular_distance_m: number | null;
}

export interface TrackRow {
  session_id: string;
  track_geojson: string | null;
}

export interface Leader {
  user_id: string;
  display_name: string;
  distance_km: number;
  complete_checklist_count: number;
  last_survey_at: string | null;
}

export interface UserRow {
  id: string;
  display_name: string | null;
  role: Role;
  created_at: string;
}

export interface RouteRow {
  id: string;
  name: string;
  governorate: string | null;
  delegation: string | null;
  habitat_notes: string | null;
  length_km: number | null;
  is_active: boolean;
  created_at: string;
  geometry?: { type: 'LineString'; coordinates: [number, number][] } | null;
}

export interface ColonyRow {
  id: string;
  name: string | null;
  species: 'cat' | 'dog' | 'mixed';
  latitude: number;
  longitude: number;
  estimated_population: number | null;
  sterilised_count: number | null;
  has_water: boolean;
  has_shelter: boolean;
  area: string | null;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
}

function ok<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export async function getMe(): Promise<Me | null> {
  if (PREVIEW) return (await loadPreview()).previewMe;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const row = await supabase
    .from('users')
    .select('display_name, role')
    .eq('id', user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? '',
    display_name: (row.data?.display_name as string | null) ?? null,
    role: (row.data?.role as Role) ?? 'volunteer',
  };
}

export const getWalks = async () =>
  PREVIEW
    ? (await loadPreview()).previewWalks
    : ok<Walk[]>(
        await supabase
          .from('sessions')
          .select(
            'id, observer_id, protocol, start_time, end_time, duration_min, distance_km, complete_session, number_of_observers, weather, time_of_day, validation_status, validation_reasons, country_code, route_id, observer:users!sessions_observer_id_fkey(display_name)'
          )
          .is('deleted_at', null)
          .order('start_time', { ascending: false })
          .limit(5000)
      );

export const getSightings = async () =>
  PREVIEW
    ? (await loadPreview()).previewSightings
    : ok<Sighting[]>(
        await supabase
          .from('observations_map')
          .select(
            'id, session_id, observed_at, species, group_size, latitude, longitude, observer_id, observer_name, protocol, public_code, body_condition_score, sex, age_class, ear_tip_or_notch, is_welfare_alert, perpendicular_distance_m'
          )
          .order('observed_at', { ascending: false })
          .limit(10000)
      );

export const getTrack = async (sessionId: string) =>
  PREVIEW
    ? (await loadPreview()).previewTracks.filter((t) => t.session_id === sessionId)
    : ok<TrackRow[]>(
        await supabase
          .from('session_tracks_geojson')
          .select('session_id, track_geojson')
          .eq('session_id', sessionId)
      );

export const getTracks = async () =>
  PREVIEW
    ? (await loadPreview()).previewTracks
    : ok<TrackRow[]>(
        await supabase
          .from('session_tracks_geojson')
          .select('session_id, track_geojson')
          .limit(2000)
      );

export interface UserStats {
  user_id: string;
  observation_count: number;
  animal_count: number;
  distance_km: number;
  complete_checklist_count: number | null;
  zero_checklist_count: number | null;
  xp: number;
  last_observed_at: string | null;
}

export const getUserStats = async () =>
  PREVIEW
    ? (await loadPreview()).previewStats
    : ok<UserStats[]>(
        await supabase
          .from('user_stats')
          .select(
            'user_id, observation_count, animal_count, distance_km, complete_checklist_count, zero_checklist_count, xp, last_observed_at'
          )
          .limit(5000)
      );

export const getLeaders = async () =>
  PREVIEW
    ? (await loadPreview()).previewLeaders
    : ok<Leader[]>(await supabase.from('effort_leaderboard').select('*').limit(1000));

export const getUsers = async () =>
  PREVIEW
    ? (await loadPreview()).previewUsers
    : ok<UserRow[]>(
        await supabase
          .from('users')
          .select('id, display_name, role, created_at')
          .order('created_at', { ascending: false })
          .limit(5000)
      );

export async function setRole(userId: string, role: Role) {
  const { error } = await supabase.from('users').update({ role }).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function getRoutes(): Promise<RouteRow[]> {
  if (PREVIEW) return (await loadPreview()).previewRoutes;
  const all = ok<RouteRow[]>(
    await supabase
      .from('routes')
      .select('id, name, governorate, delegation, habitat_notes, length_km, is_active, created_at')
      .order('created_at', { ascending: false })
  );
  const geo = ok<{ id: string; geometry: RouteRow['geometry'] }[]>(
    await supabase.from('routes_app').select('id, geometry')
  );
  const byId = new Map(geo.map((g) => [g.id, g.geometry]));
  return all.map((r) => ({ ...r, geometry: byId.get(r.id) ?? null }));
}

export async function createRoute(r: {
  name: string;
  area?: string;
  notes?: string;
  ewkt: string;
  lengthKm: number;
}) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('routes').insert({
    name: r.name,
    delegation: r.area || null,
    habitat_notes: r.notes || null,
    geometry: r.ewkt,
    length_km: Math.round(r.lengthKm * 1000) / 1000,
    is_active: true,
    created_by: u.user?.id,
  });
  if (error) throw new Error(error.message);
}

export async function setRouteActive(id: string, active: boolean) {
  const { error } = await supabase.from('routes').update({ is_active: active }).eq('id', id);
  if (error) throw new Error(error.message);
}

export const getColonies = async () =>
  PREVIEW
    ? (await loadPreview()).previewColonies
    : ok<ColonyRow[]>(await supabase.from('colonies_app').select('*').limit(5000));

export interface Individual {
  id: string;
  species: 'cat' | 'dog' | 'unknown';
  nickname: string | null;
  coat_pattern: string | null;
  created_by: string | null;
  created_at: string;
  first_seen: string | null;
  last_seen: string | null;
  sightings_count: number;
  latitude: number | null;
  longitude: number | null;
  photo_path: string | null;
  has_left_flank: boolean;
  has_right_flank: boolean;
  pending_links: number;
}

export interface Link {
  id: string;
  observation_id: string;
  individual_id: string;
  is_founder: boolean;
  decision: 'same' | 'unsure';
  status: 'proposed' | 'confirmed' | 'rejected';
  proposed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Photo {
  id: string;
  observation_id: string;
  storage_path: string;
  angle: 'left_flank' | 'right_flank' | 'face' | 'other';
}

export const getIndividuals = async () =>
  PREVIEW
    ? (await loadPreview()).previewIndividuals
    : ok<Individual[]>(
        await supabase
          .from('individuals_app')
          .select('*')
          .order('last_seen', { ascending: false, nullsFirst: false })
          .limit(5000)
      );

export const getLinks = async () =>
  PREVIEW
    ? (await loadPreview()).previewLinks
    : ok<Link[]>(
        await supabase
          .from('individual_links')
          .select(
            'id, observation_id, individual_id, is_founder, decision, status, proposed_by, created_at, reviewed_at'
          )
          .limit(20000)
      );

export async function getPhotos(observationIds: string[]): Promise<Photo[]> {
  if (PREVIEW)
    return (await loadPreview()).previewPhotos.filter((p) =>
      observationIds.includes(p.observation_id)
    );
  if (!observationIds.length) return [];
  return ok<Photo[]>(
    await supabase
      .from('photos')
      .select('id, observation_id, storage_path, angle')
      .in('observation_id', observationIds.slice(0, 200))
      .is('deleted_at', null)
  );
}

const signed = new Map<string, string>();
/** Short-lived signed URL for a photo in the private bucket; cached for the visit. */
export async function photoUrl(path: string): Promise<string | null> {
  if (PREVIEW) return `https://picsum.photos/seed/${encodeURIComponent(path)}/480/360`;
  if (signed.has(path)) return signed.get(path)!;
  const { data } = await supabase.storage.from('animal-photos').createSignedUrl(path, 3600);
  if (data?.signedUrl) signed.set(path, data.signedUrl);
  return data?.signedUrl ?? null;
}

export async function reviewLink(id: string, status: 'confirmed' | 'rejected') {
  if (PREVIEW) {
    const l = (await loadPreview()).previewLinks.find((x) => x.id === id);
    if (l) l.status = status;
    return;
  }
  const { error } = await supabase.from('individual_links').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export const getDwc = async () =>
  PREVIEW
    ? []
    : ok<Record<string, unknown>[]>(await supabase.from('dwc_occurrence').select('*').limit(50000));

/** Every export is logged server-side with who, what and how many rows. */
export async function logExport(
  type: string,
  rows: number,
  precise: boolean,
  filters: Record<string, unknown>
) {
  if (PREVIEW) return;
  await supabase.rpc('log_export', {
    p_type: type,
    p_rows: rows,
    p_precise: precise,
    p_filters: filters,
  });
}
