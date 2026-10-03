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
  /** Protocol version of the route at upload (after the route_protocols migration) */
  route_version?: number | null;
  notes?: string | null;
  app_version?: string | null;
  device_gps_accuracy_avg?: number | null;
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
  observer_latitude?: number | null;
  observer_longitude?: number | null;
  bearing_deg?: number | null;
  distance_estimate_m?: number | null;
  location_method?: string | null;
  gps_accuracy_m?: number | null;
  coat_pattern?: string | null;
  notes?: string | null;
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
  preferred_language?: string | null;
  consent_accepted_at?: string | null;
  /** From user_directory(): researchers and admins only */
  email?: string | null;
  last_sign_in_at?: string | null;
  provider?: string | null;
}

/** display_name, else the email before the @, else a neutral label. */
export const personName = (u?: Pick<UserRow, 'display_name' | 'email'> | null) =>
  u?.display_name?.trim() || u?.email?.split('@')[0] || 'Unnamed volunteer';

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
  // Walking protocol (route_protocols migration). Absent on older databases.
  direction_rule?: DirectionRule;
  side_rule?: SideRule;
  strip_width_m?: number | null;
  target_duration_min?: number | null;
  window_start?: string | null;
  window_end?: string | null;
  revisit_days?: number | null;
  require_complete?: boolean;
  instructions?: string | null;
  version?: number;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export type DirectionRule = 'as_drawn' | 'either';
export type SideRule = 'both' | 'left' | 'right';
export type RouteRules = Pick<
  RouteRow,
  | 'direction_rule'
  | 'side_rule'
  | 'strip_width_m'
  | 'target_duration_min'
  | 'window_start'
  | 'window_end'
  | 'revisit_days'
  | 'require_complete'
  | 'instructions'
>;

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
  caretaker_name?: string | null;
  feeding_schedule?: string | null;
  notes?: string | null;
  type?: string | null;
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
          // "*" so columns added by later migrations (route_version) arrive when present
          .select('*, observer:users!sessions_observer_id_fkey(display_name)')
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
            'id, session_id, observed_at, species, group_size, latitude, longitude, observer_id, observer_name, protocol, public_code, body_condition_score, sex, age_class, ear_tip_or_notch, is_welfare_alert, perpendicular_distance_m, observer_latitude, observer_longitude, bearing_deg, distance_estimate_m, location_method, gps_accuracy_m, coat_pattern, notes'
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

export async function getUsers(): Promise<UserRow[]> {
  if (PREVIEW) return (await loadPreview()).previewUsers;
  const users = ok<UserRow[]>(
    await supabase
      .from('users')
      .select('id, display_name, role, created_at, preferred_language, consent_accepted_at')
      .order('created_at', { ascending: false })
      .limit(5000)
  );
  // Emails come from a researcher-only function (display_names migration);
  // without it the portal still works with display names alone.
  const dir = await supabase.rpc('user_directory');
  if (dir.error || !Array.isArray(dir.data)) return users;
  const byId = new Map(
    (
      dir.data as {
        id: string;
        email: string | null;
        last_sign_in_at: string | null;
        provider: string | null;
      }[]
    ).map((d) => [d.id, d])
  );
  return users.map((u) => ({
    ...u,
    ...(byId.get(u.id)
      ? {
          email: byId.get(u.id)!.email,
          last_sign_in_at: byId.get(u.id)!.last_sign_in_at,
          provider: byId.get(u.id)!.provider,
        }
      : {}),
  }));
}

export async function setRole(userId: string, role: Role) {
  if (PREVIEW) {
    const u = (await loadPreview()).previewUsers.find((x) => x.id === userId);
    if (u) u.role = role;
    return;
  }
  const { error } = await supabase.from('users').update({ role }).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function getRoutes(): Promise<RouteRow[]> {
  if (PREVIEW) return (await loadPreview()).previewRoutes;
  // routes_admin carries the walking rules and archived routes; it exists once
  // the route_protocols migration is applied. Fall back to the older pair.
  const admin = await supabase
    .from('routes_admin')
    .select('*')
    .order('created_at', { ascending: false });
  if (!admin.error) return (admin.data ?? []) as RouteRow[];
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

export interface RouteDraft extends RouteRules {
  name: string;
  area?: string;
  notes?: string;
  ewkt: string;
  lengthKm: number;
}

/** Only the rule columns the database knows about are sent (older schemas). */
function rulePatch(r: Partial<RouteRules>, hasRules: boolean) {
  if (!hasRules) return {};
  return {
    direction_rule: r.direction_rule ?? 'as_drawn',
    side_rule: r.side_rule ?? 'both',
    strip_width_m: r.strip_width_m ?? null,
    target_duration_min: r.target_duration_min ?? null,
    window_start: r.window_start || null,
    window_end: r.window_end || null,
    revisit_days: r.revisit_days ?? null,
    require_complete: r.require_complete ?? true,
    instructions: r.instructions?.trim() || null,
  };
}

export async function routesHaveRules() {
  if (PREVIEW) return true;
  const { error } = await supabase.from('routes_admin').select('id').limit(1);
  return !error;
}

export async function createRoute(r: RouteDraft) {
  if (PREVIEW) {
    const p = await loadPreview();
    p.previewRoutes.unshift({
      id: `r${Date.now()}`,
      name: r.name,
      governorate: null,
      delegation: r.area || null,
      habitat_notes: r.notes || null,
      length_km: r.lengthKm,
      is_active: true,
      created_at: new Date().toISOString(),
      geometry: { type: 'LineString', coordinates: ewktCoords(r.ewkt) },
      ...rulePatch(r, true),
      version: 1,
      deleted_at: null,
    });
    return;
  }
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('routes').insert({
    name: r.name,
    delegation: r.area || null,
    habitat_notes: r.notes || null,
    geometry: r.ewkt,
    length_km: Math.round(r.lengthKm * 1000) / 1000,
    is_active: true,
    created_by: u.user?.id,
    ...rulePatch(r, await routesHaveRules()),
  });
  if (error) throw new Error(error.message);
}

export async function updateRoute(id: string, r: RouteDraft) {
  if (PREVIEW) {
    const p = await loadPreview();
    const row = p.previewRoutes.find((x) => x.id === id);
    if (row) {
      Object.assign(row, {
        name: r.name,
        delegation: r.area || null,
        habitat_notes: r.notes || null,
        length_km: r.lengthKm,
        geometry: { type: 'LineString', coordinates: ewktCoords(r.ewkt) },
        ...rulePatch(r, true),
        version: (row.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      });
    }
    return;
  }
  const { error } = await supabase
    .from('routes')
    .update({
      name: r.name,
      delegation: r.area || null,
      habitat_notes: r.notes || null,
      geometry: r.ewkt,
      length_km: Math.round(r.lengthKm * 1000) / 1000,
      ...rulePatch(r, await routesHaveRules()),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

const ewktCoords = (ewkt: string) =>
  ewkt
    .replace(/^.*LINESTRING\(/, '')
    .replace(/\)$/, '')
    .split(',')
    .map((p) => p.trim().split(' ').map(Number) as [number, number]);

export async function setRouteActive(id: string, active: boolean) {
  if (PREVIEW) {
    const row = (await loadPreview()).previewRoutes.find((x) => x.id === id);
    if (row) row.is_active = active;
    return;
  }
  const { error } = await supabase.from('routes').update({ is_active: active }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Archive: hidden from volunteers and lists, kept for the walks that used it. */
export async function archiveRoute(id: string) {
  if (PREVIEW) {
    const row = (await loadPreview()).previewRoutes.find((x) => x.id === id);
    if (row) Object.assign(row, { deleted_at: new Date().toISOString(), is_active: false });
    return;
  }
  const { error } = await supabase
    .from('routes')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function restoreRoute(id: string) {
  if (PREVIEW) {
    const row = (await loadPreview()).previewRoutes.find((x) => x.id === id);
    if (row) Object.assign(row, { deleted_at: null, is_active: true });
    return;
  }
  const { error } = await supabase
    .from('routes')
    .update({ deleted_at: null, is_active: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Permanent removal; the database refuses it for any route that was walked. */
export async function deleteRouteForever(id: string) {
  if (PREVIEW) {
    const p = await loadPreview();
    const i = p.previewRoutes.findIndex((x) => x.id === id);
    if (i >= 0) p.previewRoutes.splice(i, 1);
    return;
  }
  const { error } = await supabase.from('routes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export interface RouteRevision {
  version: number;
  rules: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

export async function getRouteRevisions(id: string): Promise<RouteRevision[]> {
  if (PREVIEW) return (await loadPreview()).previewRevisions.filter((r) => r.route_id === id);
  const res = await supabase
    .from('route_revisions')
    .select('version, rules, changed_by, changed_at')
    .eq('route_id', id)
    .order('version', { ascending: false });
  return res.error ? [] : ((res.data ?? []) as RouteRevision[]);
}

export interface TrackPoint {
  session_id: string;
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  is_mock: boolean;
  rejected_reason: string | null;
}

/** Raw fixes for one walk, rejected ones included; null before the migration. */
export async function getTrackPoints(sessionId: string): Promise<TrackPoint[] | null> {
  if (PREVIEW) return (await loadPreview()).previewPoints(sessionId);
  const res = await supabase
    .from('track_points_app')
    .select('*')
    .eq('session_id', sessionId)
    .order('recorded_at')
    .limit(20000);
  return res.error ? null : ((res.data ?? []) as TrackPoint[]);
}

export interface ObservationDetail {
  id: string;
  reproductive_status: string | null;
  visible_health_issues: string[];
  collar_or_tag: string | null;
  behaviour: string | null;
  being_fed_by_people: string | null;
  habitat_type: string | null;
  food_sources_visible: string[];
  distance_from_path_m: number | null;
  coordinate_uncertainty_m: number | null;
  grid_cell_id: string | null;
  linked_individual_id: string | null;
  created_at: string;
  synced_at: string | null;
}

export interface GroupAnimal {
  id: string;
  ordinal: number;
  sex: string;
  age_class: string;
  body_condition_score: number | null;
  ear_tip_or_notch: string;
  coat_pattern: string | null;
  primary_colour: string | null;
  individual_id: string | null;
}

export async function getObservationDetail(id: string): Promise<ObservationDetail | null> {
  if (PREVIEW) return (await loadPreview()).previewDetail(id);
  const res = await supabase
    .from('observations')
    .select(
      'id, reproductive_status, visible_health_issues, collar_or_tag, behaviour, being_fed_by_people, habitat_type, food_sources_visible, distance_from_path_m, coordinate_uncertainty_m, grid_cell_id, linked_individual_id, created_at, synced_at'
    )
    .eq('id', id)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as ObservationDetail | null) ?? null;
}

export async function getGroupAnimals(observationId: string): Promise<GroupAnimal[]> {
  if (PREVIEW) return [];
  const res = await supabase
    .from('observation_animals')
    .select(
      'id, ordinal, sex, age_class, body_condition_score, ear_tip_or_notch, coat_pattern, primary_colour, individual_id'
    )
    .eq('observation_id', observationId)
    .order('ordinal');
  return res.error ? [] : ((res.data ?? []) as GroupAnimal[]);
}

export interface ColonyVisit {
  id: string;
  colony_id: string;
  user_id: string | null;
  visited_at: string;
  tags: string[];
  notes: string | null;
}

export async function getColonyVisits(colonyId: string): Promise<ColonyVisit[]> {
  if (PREVIEW) return (await loadPreview()).previewColonyVisits(colonyId);
  return ok<ColonyVisit[]>(
    await supabase
      .from('colony_visits')
      .select('id, colony_id, user_id, visited_at, tags, notes')
      .eq('colony_id', colonyId)
      .order('visited_at', { ascending: false })
      .limit(500)
  );
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
