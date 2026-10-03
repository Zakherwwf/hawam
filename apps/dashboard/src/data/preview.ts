/**
 * Design preview only: VITE_PREVIEW=1 in development serves this sample world
 * instead of the database, so every page can be reviewed and screenshotted
 * without a researcher account. It is never active in a production build.
 *
 * The world is a few neighbourhoods of Tunis: fixed routes walked forwards
 * and (sometimes, against the rules) backwards, free walks, quick sightings,
 * raw GPS fixes with a few rejected ones, known animals with resightings.
 */
import type {
  ColonyRow,
  ColonyVisit,
  Individual,
  Leader,
  Link,
  Me,
  ObservationDetail,
  Photo,
  RouteRevision,
  RouteRow,
  Sighting,
  TrackPoint,
  TrackRow,
  UserRow,
  UserStats,
  Walk,
} from './api';

export { PREVIEW } from './flags';

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const DAY = 86400000;
const NOW = Date.now();

const NAMES = [
  'Amel Haddad',
  'Youssef Karimi',
  'Sarra Belhaj',
  'Karim Mansour',
  'Lina Trabelsi',
  'Mehdi Gharbi',
  'Nour Aziz',
  'Ines Chaabane',
  'Omar Jlassi',
  'Rania Ben Salah',
  'Hichem Ayari',
  'Salma Dridi',
  'Walid Hamdi',
  'Yasmine Kefi',
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
  role: i === 0 ? 'admin' : i === 1 ? 'researcher' : i < 6 ? 'trained_surveyor' : 'volunteer',
  created_at: new Date(NOW - (240 - i * 15) * DAY).toISOString(),
  preferred_language: pick(['ar', 'fr', 'en']),
  consent_accepted_at: new Date(NOW - (238 - i * 15) * DAY).toISOString(),
}));

// --- Routes --------------------------------------------------------------

const route = (
  id: string,
  name: string,
  area: string,
  coords: [number, number][],
  over: Partial<RouteRow> = {}
): RouteRow => ({
  id,
  name,
  governorate: 'Tunis',
  delegation: area,
  habitat_notes: null,
  length_km: lineKm(coords),
  is_active: true,
  created_at: new Date(NOW - 170 * DAY).toISOString(),
  geometry: { type: 'LineString', coordinates: coords },
  direction_rule: 'as_drawn',
  side_rule: 'both',
  strip_width_m: 25,
  target_duration_min: 40,
  window_start: '07:00',
  window_end: '10:00',
  revisit_days: 7,
  require_complete: true,
  instructions: null,
  version: 1,
  updated_at: null,
  deleted_at: null,
  ...over,
});

function lineKm(c: [number, number][]) {
  let m = 0;
  for (let i = 1; i < c.length; i++) {
    const dx = (c[i][0] - c[i - 1][0]) * 111320 * Math.cos((c[i][1] * Math.PI) / 180);
    const dy = (c[i][1] - c[i - 1][1]) * 110540;
    m += Math.hypot(dx, dy);
  }
  return Math.round(m) / 1000;
}

export const previewRoutes: RouteRow[] = [
  route(
    'r1',
    'Medina souks loop',
    'Medina',
    [
      [10.1702, 36.7986],
      [10.1718, 36.7998],
      [10.1737, 36.8004],
      [10.1756, 36.7996],
      [10.1761, 36.7979],
      [10.1745, 36.7966],
      [10.1722, 36.7968],
      [10.1704, 36.7978],
    ],
    {
      habitat_notes: 'Covered souks, food stalls, mosque courtyards',
      instructions:
        'Start at Bab Bhar facing the Medina. Walk clockwise at a steady pace. Record both sides of the lane up to 25 m. Do not re-enter the souk after leaving it.',
      version: 3,
      updated_at: new Date(NOW - 30 * DAY).toISOString(),
    }
  ),
  route(
    'r2',
    'Lafayette market streets',
    'Lafayette',
    [
      [10.1838, 36.8139],
      [10.1861, 36.8146],
      [10.1885, 36.8152],
      [10.1902, 36.8141],
      [10.1919, 36.8128],
    ],
    {
      side_rule: 'left',
      strip_width_m: 15,
      window_start: '16:00',
      window_end: '19:00',
      habitat_notes: 'Fish market back streets, restaurant bins',
      instructions:
        'Walk from the market gate to Avenue de Paris. Record the left side only: the right is a fenced car park.',
    }
  ),
  route(
    'r3',
    'Belvedere park edge',
    'Belvedere',
    [
      [10.1752, 36.8256],
      [10.1771, 36.8272],
      [10.1795, 36.8284],
      [10.1821, 36.8279],
      [10.1834, 36.8261],
      [10.1816, 36.8244],
      [10.1786, 36.8241],
    ],
    { direction_rule: 'either', revisit_days: 14, window_start: null, window_end: null }
  ),
  route(
    'r4',
    'La Goulette harbour front',
    'La Goulette',
    [
      [10.3043, 36.8183],
      [10.3071, 36.8172],
      [10.3098, 36.8161],
      [10.3126, 36.8153],
    ],
    { is_active: false, strip_width_m: 30 }
  ),
  route(
    'r5',
    'Old tram line (retired)',
    'Bab Saadoun',
    [
      [10.1631, 36.8084],
      [10.1652, 36.8101],
      [10.1676, 36.8113],
    ],
    { is_active: false, deleted_at: new Date(NOW - 12 * DAY).toISOString() }
  ),
];

export const previewRevisions: (RouteRevision & { route_id: string })[] = [
  {
    route_id: 'r1',
    version: 2,
    rules: { direction_rule: 'as_drawn', strip_width_m: 30, window_start: '07:00' },
    changed_by: 'u1',
    changed_at: new Date(NOW - 30 * DAY).toISOString(),
  },
  {
    route_id: 'r1',
    version: 1,
    rules: { direction_rule: 'either', strip_width_m: 30, window_start: null },
    changed_by: 'u0',
    changed_at: new Date(NOW - 95 * DAY).toISOString(),
  },
];

// --- Walks, tracks, sightings -------------------------------------------

const walks: Walk[] = [];
const tracks: TrackRow[] = [];
const sightings: Sighting[] = [];
const trackCoords = new Map<string, { coords: [number, number][]; start: number; dur: number }>();
const code = { cat: 120, dog: 64, unknown: 9 };
const ZONES: [number, number][] = [
  [10.1737, 36.7985],
  [10.1875, 36.8146],
  [10.1795, 36.8265],
  [10.3085, 36.8168],
  [10.1652, 36.8101],
];
// Busier volunteers walk more often
const WEIGHTS = [5, 8, 6, 9, 4, 6, 3, 5, 2, 4, 1, 3, 2, 1];
const weighted = () => {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < WEIGHTS.length; i++) if ((r -= WEIGHTS[i]) < 0) return i;
  return 0;
};

function jitter(c: [number, number][], m = 6): [number, number][] {
  return c.map(([x, y]) => [x + ((rnd() - 0.5) * m) / 90000, y + ((rnd() - 0.5) * m) / 111000]);
}
/** Densify a polyline so a walked track has a point every ~25 m. */
function densify(c: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < c.length; i++) {
    const n = Math.max(1, Math.round(lineKm([c[i - 1], c[i]]) * 40));
    for (let k = 0; k < n; k++)
      out.push([
        c[i - 1][0] + ((c[i][0] - c[i - 1][0]) * k) / n,
        c[i - 1][1] + ((c[i][1] - c[i - 1][1]) * k) / n,
      ]);
  }
  out.push(c[c.length - 1]);
  return out;
}

const active = previewRoutes.filter((r) => !r.deleted_at);
for (let i = 0; i < 190; i++) {
  const uid = weighted();
  // More walks recently: the project is growing
  const ago = Math.floor(Math.pow(rnd(), 1.35) * 175);
  const start = new Date(NOW - ago * DAY - (6 + rnd() * 12) * 3600000);
  const protocol = i % 11 === 0 ? 'incidental' : i % 9 === 0 ? 'stationary_point' : 'transect';
  const onRoute = protocol === 'transect' && rnd() > 0.35 ? pick(active) : null;
  const flagged = i === 5 || i === 21 || i === 33 || i === 77 || i === 120 || i === 151;
  const id = `w${i}`;

  let coords: [number, number][] = [];
  if (onRoute?.geometry) {
    let c = onRoute.geometry.coordinates;
    // One walk in six goes the wrong way round
    if (rnd() < 0.17) c = [...c].reverse();
    // Some stop early
    if (rnd() < 0.15) c = c.slice(0, Math.max(2, Math.ceil(c.length * 0.6)));
    coords = jitter(densify(c));
  } else if (protocol === 'transect') {
    const z = pick(ZONES);
    coords = [[z[0] + (rnd() - 0.5) * 0.01, z[1] + (rnd() - 0.5) * 0.008]];
    let heading = rnd() * Math.PI * 2;
    for (let k = 0; k < 60; k++) {
      heading += (rnd() - 0.5) * 0.7;
      const [x, y] = coords[k];
      coords.push([x + Math.cos(heading) * 0.00028, y + Math.sin(heading) * 0.00022]);
    }
  } else if (protocol === 'stationary_point') {
    const z = pick(ZONES);
    coords = [[z[0] + (rnd() - 0.5) * 0.01, z[1] + (rnd() - 0.5) * 0.008]];
  }
  const km = protocol === 'transect' ? lineKm(coords) : 0;
  const dur =
    protocol === 'incidental'
      ? 0
      : protocol === 'stationary_point'
        ? 10
        : Math.round(km * (13 + rnd() * 9) + rnd() * 6);

  walks.push({
    id,
    observer_id: `u${uid}`,
    protocol: protocol as Walk['protocol'],
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + dur * 60000).toISOString(),
    duration_min: dur,
    distance_km: km,
    complete_session: protocol !== 'incidental' && rnd() > 0.18,
    number_of_observers: rnd() > 0.85 ? 2 : 1,
    weather: pick(['clear', 'clear', 'cloudy', 'rain', 'wind', null]),
    time_of_day: start.getHours() < 11 ? 'morning' : start.getHours() < 16 ? 'afternoon' : 'dusk',
    validation_status: flagged ? 'flagged' : 'valid',
    validation_reasons: flagged
      ? [pick(['vehicle_speed', 'mock_location', 'teleport', 'duplicate_upload'])]
      : [],
    country_code: 'TN',
    route_id: onRoute?.id ?? null,
    route_version: onRoute
      ? (onRoute.version ?? 1) - (ago > 30 && onRoute.id === 'r1' ? 1 : 0)
      : null,
    notes:
      rnd() > 0.85
        ? pick(['Market closed today', 'Street cleaning crew ahead of me', 'Light rain at the end'])
        : null,
    app_version: '3.2.0',
    device_gps_accuracy_avg: Math.round((4 + rnd() * 9) * 10) / 10,
    observer: { display_name: NAMES[uid] },
  });

  if (coords.length > 1) {
    tracks.push({
      session_id: id,
      track_geojson: JSON.stringify({ type: 'LineString', coordinates: coords }),
    });
    trackCoords.set(id, { coords, start: start.getTime(), dur });
  }

  const nObs =
    protocol === 'incidental'
      ? 1
      : rnd() > 0.22
        ? Math.floor(rnd() * (onRoute?.id === 'r1' ? 7 : 5))
        : 0;
  for (let k = 0; k < nObs; k++) {
    const sp = rnd() > 0.38 ? 'cat' : rnd() > 0.1 ? 'dog' : 'unknown';
    code[sp] += 1;
    const base: [number, number] = coords.length
      ? coords[Math.floor(rnd() * coords.length)]
      : [pick(ZONES)[0] + (rnd() - 0.5) * 0.01, pick(ZONES)[1] + (rnd() - 0.5) * 0.008];
    const bearing = Math.round(rnd() * 359);
    const dist = Math.round(2 + rnd() * 22);
    const lon = base[0] + (Math.sin((bearing * Math.PI) / 180) * dist) / 89500;
    const lat = base[1] + (Math.cos((bearing * Math.PI) / 180) * dist) / 111000;
    sightings.push({
      id: `${id}-o${k}`,
      session_id: id,
      observed_at: new Date(start.getTime() + (k + 1) * (dur / (nObs + 1)) * 60000).toISOString(),
      species: sp,
      group_size: rnd() > 0.78 ? 2 + Math.floor(rnd() * 3) : 1,
      latitude: lat,
      longitude: lon,
      observer_id: `u${uid}`,
      observer_name: NAMES[uid],
      protocol,
      public_code: `${sp === 'cat' ? 'CAT' : sp === 'dog' ? 'DOG' : 'OBS'}-${String(code[sp]).padStart(6, '0')}`,
      body_condition_score: rnd() > 0.35 ? 1 + Math.floor(rnd() * 5) : null,
      sex: pick(['male', 'female', 'unknown']),
      age_class: pick(['adult', 'adult', 'juvenile', 'unknown']),
      ear_tip_or_notch: pick(['yes', 'no', 'no', 'unknown']),
      is_welfare_alert: rnd() > 0.95,
      perpendicular_distance_m:
        protocol === 'transect' && rnd() > 0.15
          ? Math.round(Math.abs(Math.sin((bearing * Math.PI) / 180)) * dist * 10) / 10
          : null,
      observer_latitude: base[1],
      observer_longitude: base[0],
      bearing_deg: bearing,
      distance_estimate_m: dist,
      location_method: 'bearing_distance',
      gps_accuracy_m: Math.round((3 + rnd() * 10) * 10) / 10,
      coat_pattern:
        sp === 'cat'
          ? pick(['tabby', 'bicolour_piebald', 'solid_black', 'tortoiseshell_calico'])
          : null,
      notes:
        rnd() > 0.85
          ? pick([
              'Limping on the front left leg',
              'Being fed by a shop owner',
              'Sleeping under a car',
              'Mother with two kittens nearby',
            ])
          : null,
    });
  }
}
walks.sort((a, b) => b.start_time.localeCompare(a.start_time));
sightings.sort((a, b) => b.observed_at.localeCompare(a.observed_at));
export const previewWalks = walks;
export const previewSightings = sightings;
export const previewTracks = tracks;

/** Raw fixes along the walked track, every ~25 m, a few rejected for accuracy. */
export function previewPoints(sessionId: string): TrackPoint[] {
  const t = trackCoords.get(sessionId);
  if (!t) return [];
  const n = t.coords.length;
  const flagged = walks.find((w) => w.id === sessionId)?.validation_status === 'flagged';
  return t.coords.map(([lon, lat], k) => {
    const acc =
      Math.round((3 + Math.abs(Math.sin(k * 1.7)) * 9 + (k % 23 === 7 ? 40 : 0)) * 10) / 10;
    const base = 1.1 + Math.sin(k / 4) * 0.25;
    return {
      session_id: sessionId,
      recorded_at: new Date(t.start + (k / Math.max(1, n - 1)) * t.dur * 60000).toISOString(),
      latitude: lat,
      longitude: lon,
      accuracy_m: acc,
      speed_mps: Math.round((flagged && k > n / 2 ? base * 5.5 : base) * 100) / 100,
      is_mock: false,
      rejected_reason: acc > 30 ? 'low_accuracy' : null,
    };
  });
}

export function previewDetail(id: string): ObservationDetail | null {
  const s = sightings.find((x) => x.id === id);
  if (!s) return null;
  const h = id.length;
  return {
    id,
    reproductive_status:
      s.sex === 'female' ? pick(['none_visible', 'lactating', 'unknown']) : 'unknown',
    visible_health_issues: s.is_welfare_alert ? ['limping', 'wound'] : h % 3 ? ['none'] : [],
    collar_or_tag: pick(['no', 'no', 'yes', 'unknown']),
    behaviour: pick(['resting', 'walking', 'feeding', 'interacting_people']),
    being_fed_by_people: pick(['yes', 'no', 'unknown']),
    habitat_type: pick(['market', 'residential', 'commercial', 'park']),
    food_sources_visible: pick([['bins'], ['people_feeding', 'bins'], []]),
    distance_from_path_m: s.perpendicular_distance_m,
    coordinate_uncertainty_m: 1000,
    grid_cell_id: 'TN32N-E0598-N4073',
    linked_individual_id: previewLinks.find((l) => l.observation_id === id)?.individual_id ?? null,
    created_at: s.observed_at,
    synced_at: new Date(new Date(s.observed_at).getTime() + 3600000).toISOString(),
  };
}

// --- People stats ---------------------------------------------------------

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

// --- Colonies ----------------------------------------------------------

export const previewColonies: ColonyRow[] = [
  {
    id: 'c1',
    name: 'Souk el Attarine cats',
    species: 'cat',
    latitude: 36.7992,
    longitude: 10.1731,
    estimated_population: 14,
    sterilised_count: 9,
    has_water: true,
    has_shelter: true,
    area: 'Medina',
    visit_count: 11,
    last_visit_at: new Date(NOW - 3 * DAY).toISOString(),
    created_at: new Date(NOW - 120 * DAY).toISOString(),
    caretaker_name: 'Spice seller at stall 14',
    feeding_schedule: 'Every evening around 18:00',
    notes: 'Two kittens seen in September.',
  },
  {
    id: 'c2',
    name: 'Fish market pack',
    species: 'dog',
    latitude: 36.8149,
    longitude: 10.1879,
    estimated_population: 6,
    sterilised_count: 1,
    has_water: false,
    has_shelter: false,
    area: 'Lafayette',
    visit_count: 4,
    last_visit_at: new Date(NOW - 16 * DAY).toISOString(),
    created_at: new Date(NOW - 60 * DAY).toISOString(),
    caretaker_name: null,
    feeding_schedule: null,
    notes: 'Wary of people; keep distance.',
  },
  {
    id: 'c3',
    name: 'Belvedere school garden',
    species: 'mixed',
    latitude: 36.8268,
    longitude: 10.1806,
    estimated_population: 7,
    sterilised_count: null,
    has_water: true,
    has_shelter: false,
    area: 'Belvedere',
    visit_count: 0,
    last_visit_at: null,
    created_at: new Date(NOW - 8 * DAY).toISOString(),
    caretaker_name: 'School caretaker',
    feeding_schedule: 'Weekdays at noon',
    notes: null,
  },
  {
    id: 'c4',
    name: 'Harbour warehouse cats',
    species: 'cat',
    latitude: 36.8166,
    longitude: 10.3079,
    estimated_population: 9,
    sterilised_count: 3,
    has_water: true,
    has_shelter: true,
    area: 'La Goulette',
    visit_count: 6,
    last_visit_at: new Date(NOW - 41 * DAY).toISOString(),
    created_at: new Date(NOW - 150 * DAY).toISOString(),
    caretaker_name: null,
    feeding_schedule: null,
    notes: null,
  },
];

export function previewColonyVisits(colonyId: string): ColonyVisit[] {
  const c = previewColonies.find((x) => x.id === colonyId);
  if (!c) return [];
  return Array.from({ length: c.visit_count }, (_, k) => ({
    id: `${colonyId}-v${k}`,
    colony_id: colonyId,
    user_id: `u${(k * 3) % NAMES.length}`,
    visited_at: new Date(NOW - (3 + k * 9) * DAY).toISOString(),
    tags:
      k % 3 === 0
        ? ['fed', 'water_refilled']
        : k % 3 === 1
          ? ['count_updated']
          : ['health_concern'],
    notes: k % 4 === 0 ? 'All animals looked healthy.' : null,
  }));
}

// --- Known animals ------------------------------------------------------

// Known animals live in one neighbourhood: take their sightings from walks on one route
const onRoute = (rid: string) => new Set(walks.filter((w) => w.route_id === rid).map((w) => w.id));
const r1 = onRoute('r1');
const r2 = onRoute('r2');
const catSightings = sightings.filter(
  (x) => x.species === 'cat' && x.group_size === 1 && r1.has(x.session_id)
);
const dogSightings = sightings.filter(
  (x) => x.species === 'dog' && x.group_size === 1 && r2.has(x.session_id)
);
const groups: { sp: 'cat' | 'dog'; name: string | null; coat: string; obs: Sighting[] }[] = [
  { sp: 'cat', name: 'Zaatar', coat: 'tabby', obs: catSightings.slice(0, 7) },
  { sp: 'cat', name: null, coat: 'solid_black', obs: catSightings.slice(7, 10) },
  { sp: 'cat', name: 'Harissa', coat: 'tortoiseshell_calico', obs: catSightings.slice(10, 15) },
  { sp: 'cat', name: 'Bsissa', coat: 'bicolour_piebald', obs: catSightings.slice(15, 17) },
  { sp: 'dog', name: 'Kammoun', coat: 'solid_other', obs: dogSightings.slice(0, 5) },
  { sp: 'dog', name: 'Fell', coat: 'bicolour_piebald', obs: dogSightings.slice(5, 7) },
];
export const previewIndividuals: Individual[] = [];
export const previewLinks: Link[] = [];
export const previewPhotos: Photo[] = [];
groups.forEach((g, gi) => {
  if (!g.obs.length) return;
  const sorted = [...g.obs].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  const id = `ind${gi}`;
  sorted.forEach((o, k) => {
    const pending = k >= sorted.length - 2 && k > 1;
    previewLinks.push({
      id: `${id}-l${k}`,
      observation_id: o.id,
      individual_id: id,
      is_founder: k === 0,
      decision: k === sorted.length - 1 ? 'unsure' : 'same',
      status: pending ? 'proposed' : k === 3 ? 'rejected' : 'confirmed',
      proposed_by: o.observer_id,
      created_at: o.observed_at,
      reviewed_at: pending ? null : o.observed_at,
    });
    previewPhotos.push({
      id: `${id}-p${k}`,
      observation_id: o.id,
      storage_path: `${g.sp}-${gi}-${k}`,
      angle: k % 3 === 2 ? 'face' : k % 2 ? 'right_flank' : 'left_flank',
    });
  });
  const confirmed = sorted.filter(
    (_, k) => previewLinks.find((l) => l.id === `${id}-l${k}`)?.status === 'confirmed'
  );
  const last = confirmed[confirmed.length - 1] ?? sorted[0];
  previewIndividuals.push({
    id,
    species: g.sp,
    nickname: g.name,
    coat_pattern: g.coat,
    created_by: sorted[0].observer_id,
    created_at: sorted[0].observed_at,
    first_seen: sorted[0].observed_at,
    last_seen: last.observed_at,
    sightings_count: confirmed.length,
    latitude: last.latitude,
    longitude: last.longitude,
    photo_path: `${g.sp}-${gi}-0`,
    has_left_flank: true,
    has_right_flank: sorted.length > 1,
    pending_links: previewLinks.filter((l) => l.individual_id === id && l.status === 'proposed')
      .length,
  });
});
