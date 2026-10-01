/**
 * Design preview only: VITE_PREVIEW=1 in development serves this sample world
 * instead of the database, so every page can be reviewed and screenshotted
 * without a researcher account. It is never active in a production build.
 */
import type {
  Individual,
  Link,
  Photo,
  ColonyRow,
  Leader,
  Me,
  RouteRow,
  Sighting,
  TrackRow,
  UserRow,
  UserStats,
  Walk,
} from './api';

export { PREVIEW } from './flags';

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const LAT = 38.7169;
const LON = -9.1399;
const NAMES = [
  'Amel Haddad',
  'Youssef Karimi',
  'Sarra Belhaj',
  'Karim Mansour',
  'Lina Ferreira',
  'Tomás Rocha',
  'Nour Aziz',
  'Inès Costa',
];

export const previewMe: Me = {
  id: 'u0',
  email: 'amel@research.example',
  display_name: 'Amel Haddad',
  role: 'admin',
};
export const previewUsers: UserRow[] = NAMES.map((n, i) => ({
  id: `u${i}`,
  display_name: n,
  role: i === 0 ? 'admin' : i === 1 ? 'researcher' : i < 4 ? 'trained_surveyor' : 'volunteer',
  created_at: new Date(Date.now() - (200 - i * 20) * 86400000).toISOString(),
}));

const walks: Walk[] = [];
const tracks: TrackRow[] = [];
const sightings: Sighting[] = [];
let code = { cat: 120, dog: 64, unknown: 9 };
for (let i = 0; i < 46; i++) {
  const uid = Math.floor(rnd() * NAMES.length);
  const start = new Date(Date.now() - Math.floor(rnd() * 140) * 86400000 - rnd() * 36000000);
  const protocol = i % 9 === 0 ? 'incidental' : i % 7 === 0 ? 'stationary_point' : 'transect';
  const dur = protocol === 'incidental' ? 0 : 18 + Math.floor(rnd() * 55);
  const km = protocol === 'transect' ? Math.round((0.6 + rnd() * 2.8) * 100) / 100 : 0;
  const flagged = i === 5 || i === 21 || i === 33;
  const id = `w${i}`;
  walks.push({
    id,
    observer_id: `u${uid}`,
    protocol: protocol as Walk['protocol'],
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + dur * 60000).toISOString(),
    duration_min: dur,
    distance_km: km,
    complete_session: protocol !== 'incidental' && rnd() > 0.2,
    number_of_observers: rnd() > 0.8 ? 2 : 1,
    weather: pick(['clear', 'cloudy', 'rain', 'wind', null]),
    time_of_day: pick(['morning', 'afternoon', 'dusk']),
    validation_status: flagged ? 'flagged' : 'valid',
    validation_reasons: flagged ? [pick(['vehicle_speed', 'mock_location'])] : [],
    country_code: 'PT',
    route_id: null,
    observer: { display_name: NAMES[uid] },
  });
  const o = [LON + (rnd() - 0.5) * 0.06, LAT + (rnd() - 0.5) * 0.04];
  const coords: [number, number][] = [[o[0], o[1]]];
  if (protocol === 'transect')
    for (let k = 0; k < 12; k++)
      coords.push([coords[k][0] + (rnd() - 0.4) * 0.0025, coords[k][1] + (rnd() - 0.4) * 0.0018]);
  if (coords.length > 1)
    tracks.push({
      session_id: id,
      track_geojson: JSON.stringify({ type: 'LineString', coordinates: coords }),
    });
  const nObs = protocol === 'incidental' ? 1 : rnd() > 0.25 ? Math.floor(rnd() * 5) : 0;
  for (let k = 0; k < nObs; k++) {
    const sp = rnd() > 0.35 ? 'cat' : rnd() > 0.1 ? 'dog' : 'unknown';
    code[sp] += 1;
    const at = coords[Math.floor(rnd() * coords.length)];
    sightings.push({
      id: `${id}-o${k}`,
      session_id: id,
      observed_at: new Date(start.getTime() + k * 240000).toISOString(),
      species: sp,
      group_size: rnd() > 0.75 ? 2 + Math.floor(rnd() * 3) : 1,
      latitude: at[1] + (rnd() - 0.5) * 0.0004,
      longitude: at[0] + (rnd() - 0.5) * 0.0004,
      observer_id: `u${uid}`,
      observer_name: NAMES[uid],
      protocol,
      public_code: `${sp === 'cat' ? 'CAT' : sp === 'dog' ? 'DOG' : 'OBS'}-${String(code[sp]).padStart(6, '0')}`,
      body_condition_score: rnd() > 0.4 ? 1 + Math.floor(rnd() * 5) : null,
      sex: pick(['male', 'female', 'unknown']),
      age_class: pick(['adult', 'juvenile', 'unknown']),
      ear_tip_or_notch: pick(['yes', 'no', 'unknown']),
      is_welfare_alert: false,
      perpendicular_distance_m:
        protocol === 'transect' && rnd() > 0.2 ? Math.round(rnd() * 250) / 10 : null,
    });
  }
}
walks.sort((a, b) => b.start_time.localeCompare(a.start_time));
sightings.sort((a, b) => b.observed_at.localeCompare(a.observed_at));
export const previewWalks = walks;
export const previewSightings = sightings;
export const previewTracks = tracks;

export const previewStats: UserStats[] = previewUsers.map((u) => {
  const w = walks.filter((x) => x.observer_id === u.id && x.validation_status !== 'flagged');
  const s = sightings.filter((x) => x.observer_id === u.id);
  const complete = w.filter((x) => x.protocol !== 'incidental' && x.complete_session);
  return {
    user_id: u.id,
    observation_count: s.length,
    animal_count: s.reduce((a, x) => a + x.group_size, 0),
    distance_km: w.reduce((a, x) => a + (x.distance_km ?? 0), 0),
    complete_checklist_count: complete.length,
    zero_checklist_count: complete.filter((x) => !s.some((o) => o.session_id === x.id)).length,
    xp: 0,
    last_observed_at: s[0]?.observed_at ?? null,
  };
});
for (const st of previewStats)
  st.xp = Math.round(
    st.observation_count * 10 + st.complete_checklist_count! * 25 + Math.floor(st.distance_km) * 5
  );
export const previewLeaders: Leader[] = previewStats
  .filter((s) => s.distance_km > 0)
  .map((s) => ({
    user_id: s.user_id,
    display_name: previewUsers.find((u) => u.id === s.user_id)!.display_name!,
    distance_km: s.distance_km,
    complete_checklist_count: s.complete_checklist_count ?? 0,
    last_survey_at: null,
  }));

export const previewRoutes: RouteRow[] = [
  {
    id: 'r1',
    name: 'Riverside loop',
    governorate: null,
    delegation: 'Old town',
    habitat_notes: 'Market lanes and the river wall',
    length_km: 2.1,
    is_active: true,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    geometry: {
      type: 'LineString',
      coordinates: [
        [-9.136, 38.711],
        [-9.131, 38.713],
        [-9.127, 38.716],
        [-9.13, 38.72],
        [-9.136, 38.719],
      ],
    },
  },
  {
    id: 'r2',
    name: 'Hilltop stairs',
    governorate: null,
    delegation: 'North quarter',
    habitat_notes: null,
    length_km: 1.4,
    is_active: false,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    geometry: {
      type: 'LineString',
      coordinates: [
        [-9.145, 38.722],
        [-9.142, 38.726],
        [-9.139, 38.729],
      ],
    },
  },
];

export const previewColonies: ColonyRow[] = [
  {
    id: 'c1',
    name: 'Market cats',
    species: 'cat',
    latitude: 38.713,
    longitude: -9.133,
    estimated_population: 11,
    sterilised_count: 7,
    has_water: true,
    has_shelter: true,
    area: 'Old town',
    visit_count: 9,
    last_visit_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 'c2',
    name: 'Harbour pack',
    species: 'dog',
    latitude: 38.707,
    longitude: -9.146,
    estimated_population: 5,
    sterilised_count: 1,
    has_water: false,
    has_shelter: false,
    area: 'Harbour',
    visit_count: 2,
    last_visit_at: new Date(Date.now() - 16 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: 'c3',
    name: 'School garden',
    species: 'mixed',
    latitude: 38.724,
    longitude: -9.151,
    estimated_population: 6,
    sterilised_count: null,
    has_water: true,
    has_shelter: false,
    area: null,
    visit_count: 0,
    last_visit_at: null,
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
];

// Individuals: a few animals seen on several walks, with proposed resightings to review
const catSightings = sightings.filter((x) => x.species === 'cat');
const dogSightings = sightings.filter((x) => x.species === 'dog');
const groups: { sp: 'cat' | 'dog'; name: string | null; coat: string; obs: Sighting[] }[] = [
  { sp: 'cat', name: 'Ginger', coat: 'tabby', obs: catSightings.slice(0, 4) },
  { sp: 'cat', name: null, coat: 'solid_black', obs: catSightings.slice(4, 6) },
  { sp: 'cat', name: 'Patch', coat: 'bicolour_piebald', obs: catSightings.slice(6, 9) },
  { sp: 'dog', name: 'Biscuit', coat: 'solid_other', obs: dogSightings.slice(0, 3) },
];
export const previewIndividuals: Individual[] = [];
export const previewLinks: Link[] = [];
export const previewPhotos: Photo[] = [];
groups.forEach((g, gi) => {
  if (!g.obs.length) return;
  const sorted = [...g.obs].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  const id = `ind${gi}`;
  sorted.forEach((o, k) => {
    previewLinks.push({
      id: `${id}-l${k}`,
      observation_id: o.id,
      individual_id: id,
      is_founder: k === 0,
      decision: k === 2 ? 'unsure' : 'same',
      status: k === 0 || k === 1 ? 'confirmed' : 'proposed',
      proposed_by: o.observer_id,
      created_at: o.observed_at,
      reviewed_at: null,
    });
    previewPhotos.push({
      id: `${id}-p${k}`,
      observation_id: o.id,
      storage_path: `${g.sp}-${gi}-${k}`,
      angle: k % 2 ? 'right_flank' : 'left_flank',
    });
  });
  const last = sorted[sorted.length - 1];
  previewIndividuals.push({
    id,
    species: g.sp,
    nickname: g.name,
    coat_pattern: g.coat,
    created_by: sorted[0].observer_id,
    created_at: sorted[0].observed_at,
    first_seen: sorted[0].observed_at,
    last_seen: last.observed_at,
    sightings_count: sorted.length,
    latitude: last.latitude,
    longitude: last.longitude,
    photo_path: `${g.sp}-${gi}-0`,
    has_left_flank: true,
    has_right_flank: sorted.length > 1,
    pending_links: sorted.filter((_, k) => k >= 2).length,
  });
});
