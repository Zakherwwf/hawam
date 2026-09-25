-- ==============================================================================
-- Hawem (حايم) v2 Comprehensive PostGIS Schema & RLS Policies
-- Migration: 20260923000004_v2_comprehensive_schema.sql
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & USERS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'fr', 'en')),
  role TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'trained_surveyor', 'researcher', 'admin')),
  team_id UUID,
  xp_total INTEGER NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 30),
  leaderboard_visibility TEXT NOT NULL DEFAULT 'public' CHECK (leaderboard_visibility IN ('public', 'anonymous', 'hidden')),
  consent_version TEXT NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. PRIVACY ZONES (Observer protection)
CREATE TABLE IF NOT EXISTS public.privacy_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  center GEOGRAPHY(Point, 4326) NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 300 CHECK (radius_m BETWEEN 100 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_privacy_zones_center ON public.privacy_zones USING GIST (center);

-- 3. FIXED ROUTES
CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  geometry GEOGRAPHY(LineString, 4326) NOT NULL,
  length_km NUMERIC(6, 3) NOT NULL,
  governorate_code TEXT NOT NULL,
  delegation_code TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'moderate', 'challenging')),
  created_by UUID REFERENCES public.profiles(id),
  is_official BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_routes_geometry ON public.routes USING GIST (geometry);

-- 4. COLONIES & FEEDING STATIONS
CREATE TABLE IF NOT EXISTS public.colonies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('cat_colony', 'feeding_point', 'dog_pack_area')),
  location GEOGRAPHY(Point, 4326) NOT NULL,
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  last_verified_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_colonies_location ON public.colonies USING GIST (location);

-- 5. SESSIONS (Sampling Events with Effort)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  protocol TEXT NOT NULL CHECK (protocol IN ('transect', 'stationary_point', 'incidental')),
  route_id UUID REFERENCES public.routes(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  moving_time_s INTEGER NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL DEFAULT 0,
  distance_m NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  track GEOGRAPHY(LineString, 4326),
  complete_session BOOLEAN NOT NULL DEFAULT false,
  n_observers INTEGER NOT NULL DEFAULT 1 CHECK (n_observers >= 1),
  weather TEXT CHECK (weather IN ('clear', 'cloudy', 'rain', 'wind', 'hot')),
  time_of_day TEXT CHECK (time_of_day IN ('dawn', 'morning', 'afternoon', 'dusk', 'night')),
  avg_gps_accuracy_m NUMERIC(6, 2),
  mock_location_detected BOOLEAN NOT NULL DEFAULT false,
  app_version TEXT,
  device_model TEXT,
  h3_cells_res9 TEXT[],
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_track ON public.sessions USING GIST (track);

-- 6. TRACK POINTS (Raw GPS Breadcrumbs)
CREATE TABLE IF NOT EXISTS public.track_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  accuracy_m NUMERIC(6, 2) NOT NULL,
  altitude NUMERIC(7, 2),
  speed NUMERIC(5, 2),
  heading NUMERIC(5, 2),
  provider TEXT,
  is_mock BOOLEAN NOT NULL DEFAULT false,
  rejected_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_track_points_session ON public.track_points(session_id);
CREATE INDEX IF NOT EXISTS idx_track_points_location ON public.track_points USING GIST (location);

-- 7. KNOWN INDIVIDUALS (Capture-Recapture Registry)
CREATE TABLE IF NOT EXISTS public.individuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species TEXT NOT NULL CHECK (species IN ('cat', 'dog')),
  nickname TEXT,
  coat_pattern TEXT NOT NULL,
  primary_colour TEXT,
  identifiability TEXT NOT NULL DEFAULT 'high' CHECK (identifiability IN ('high', 'low')),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  sightings_count INTEGER NOT NULL DEFAULT 1,
  first_identified_by UUID REFERENCES public.profiles(id),
  colony_id UUID REFERENCES public.colonies(id),
  ear_tipped BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'not_seen_recently', 'reported_deceased')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. OBSERVATIONS
CREATE TABLE IF NOT EXISTS public.observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  observed_at TIMESTAMPTZ NOT NULL,
  observer_location GEOGRAPHY(Point, 4326) NOT NULL,
  animal_location GEOGRAPHY(Point, 4326) NOT NULL,
  location_method TEXT NOT NULL CHECK (location_method IN ('compass', 'map_tap', 'same_as_observer')),
  bearing_deg NUMERIC(5, 2),
  distance_estimate_m NUMERIC(6, 2),
  perpendicular_distance_m NUMERIC(6, 2),
  gps_accuracy_m NUMERIC(6, 2),
  h3_res9 TEXT,
  h3_res7 TEXT,
  governorate_code TEXT,
  delegation_code TEXT,
  species TEXT NOT NULL CHECK (species IN ('cat', 'dog', 'unknown')),
  group_size INTEGER NOT NULL DEFAULT 1 CHECK (group_size >= 1),
  individual_id UUID REFERENCES public.individuals(id),
  is_welfare_alert BOOLEAN NOT NULL DEFAULT false,
  colony_id UUID REFERENCES public.colonies(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_observations_session ON public.observations(session_id);
CREATE INDEX IF NOT EXISTS idx_observations_animal_location ON public.observations USING GIST (animal_location);
CREATE INDEX IF NOT EXISTS idx_observations_h3_res9 ON public.observations(h3_res9);

-- 9. OBSERVATION ANIMAL ATTRIBUTES
CREATE TABLE IF NOT EXISTS public.observation_animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
  sex TEXT DEFAULT 'unknown' CHECK (sex IN ('male', 'female', 'unknown')),
  age_class TEXT DEFAULT 'unknown' CHECK (age_class IN ('juvenile', 'adult', 'unknown')),
  reproductive_status TEXT DEFAULT 'none_visible' CHECK (reproductive_status IN ('lactating', 'visibly_pregnant', 'none_visible', 'unknown')),
  body_condition_score INTEGER CHECK (body_condition_score BETWEEN 1 AND 5),
  health_issues TEXT[] DEFAULT '{}',
  ear_tip_or_notch TEXT DEFAULT 'unknown' CHECK (ear_tip_or_notch IN ('yes', 'no', 'unknown')),
  collar_or_tag TEXT DEFAULT 'unknown' CHECK (collar_or_tag IN ('yes', 'no', 'unknown')),
  behaviour TEXT DEFAULT 'neutral' CHECK (behaviour IN ('approachable', 'neutral', 'fearful', 'aggressive')),
  being_fed_by_people TEXT DEFAULT 'unknown' CHECK (being_fed_by_people IN ('yes', 'no', 'unknown')),
  coat_pattern TEXT,
  primary_colour TEXT,
  habitat_type TEXT,
  food_sources_visible TEXT[] DEFAULT '{}'
);

-- 10. PHOTOS
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  angle TEXT NOT NULL CHECK (angle IN ('left_flank', 'right_flank', 'face', 'other')),
  width INTEGER,
  height INTEGER,
  blur_score NUMERIC(4, 2),
  brightness_score NUMERIC(4, 2),
  taken_at TIMESTAMPTZ NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'synced' CHECK (upload_status IN ('pending', 'uploading', 'synced', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. INDIVIDUAL MATCHES
CREATE TABLE IF NOT EXISTS public.individual_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
  candidate_individual_id UUID NOT NULL REFERENCES public.individuals(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('human', 'algorithm')),
  decision TEXT NOT NULL CHECK (decision IN ('same', 'different', 'unsure')),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. GAMIFICATION TABLES
CREATE TABLE IF NOT EXISTS public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID,
  xp INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user ON public.xp_events(user_id);

CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_fr TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  icon_name TEXT NOT NULL,
  xp_award INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES public.badge_definitions(id),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  quest_type TEXT NOT NULL,
  xp_reward INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL DEFAULT 1,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, quest_id)
);

CREATE TABLE IF NOT EXISTS public.streaks (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak_weeks INTEGER NOT NULL DEFAULT 0,
  longest_streak_weeks INTEGER NOT NULL DEFAULT 0,
  last_survey_week INTEGER,
  last_survey_year INTEGER,
  freezes_available INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. ACADEMY TABLES
CREATE TABLE IF NOT EXISTS public.academy_modules (
  id TEXT PRIMARY KEY,
  order_index INTEGER NOT NULL,
  title_en TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  summary_fr TEXT NOT NULL,
  summary_ar TEXT NOT NULL,
  content_markdown_en TEXT NOT NULL,
  content_markdown_fr TEXT NOT NULL,
  content_markdown_ar TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES public.academy_modules(id),
  passed BOOLEAN NOT NULL DEFAULT false,
  score_percent INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, module_id)
);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colonies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_academy_progress ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone authenticated can read; users can update own profile
CREATE POLICY "Profiles readable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Privacy Zones: Strictly owned and readable only by owner
CREATE POLICY "Users control own privacy zones" ON public.privacy_zones
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Routes, Colonies, Individuals: Publicly readable by all authenticated
CREATE POLICY "Routes readable by authenticated" ON public.routes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Colonies readable by authenticated" ON public.colonies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Individuals readable by authenticated" ON public.individuals
  FOR SELECT TO authenticated USING (true);

-- Sessions: Users can create and view their own; researchers can read all valid sessions
CREATE POLICY "Users manage own sessions" ON public.sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Researchers read valid sessions" ON public.sessions
  FOR SELECT TO authenticated USING (
    validation_status = 'valid' OR auth.uid() = user_id
  );

-- Observations: Users manage their own; authenticated users can read all observations
CREATE POLICY "Users manage own observations" ON public.observations
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "All authenticated read observations" ON public.observations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated read observation animals" ON public.observation_animals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage observation animals" ON public.observation_animals
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.observations o WHERE o.id = observation_id AND o.user_id = auth.uid())
  );

-- Photos & Matches
CREATE POLICY "All authenticated read photos" ON public.photos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own photos" ON public.photos
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.observations o WHERE o.id = observation_id AND o.user_id = auth.uid())
  );

CREATE POLICY "All authenticated read matches" ON public.individual_matches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users propose matches" ON public.individual_matches
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Gamification: Read-only for user; writes restricted to service role / RPC
CREATE POLICY "Users view own xp events" ON public.xp_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users view badges" ON public.user_badges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users view quests" ON public.user_quests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users view streaks" ON public.streaks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ==============================================================================
-- SECURITY-DEFINER VIEWS & RPCs
-- ==============================================================================

-- 1. Track points filtered by privacy zones
CREATE OR REPLACE VIEW public.visible_track_points AS
SELECT tp.*
FROM public.track_points tp
JOIN public.sessions s ON tp.session_id = s.id
WHERE s.user_id = auth.uid() -- Owner sees their own entire track
   OR NOT EXISTS (
     SELECT 1 FROM public.privacy_zones pz
     WHERE pz.user_id = s.user_id
       AND ST_DWithin(tp.location, pz.center, pz.radius_m)
   );

-- 2. Nearby individuals query (300m radius)
CREATE OR REPLACE FUNCTION public.nearby_individuals(
  p_species TEXT,
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 300.0
)
RETURNS TABLE (
  id UUID,
  species TEXT,
  nickname TEXT,
  coat_pattern TEXT,
  sightings_count INTEGER,
  distance_m DOUBLE PRECISION,
  photo_thumbnail_path TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    i.id,
    i.species,
    i.nickname,
    i.coat_pattern,
    i.sightings_count,
    ST_Distance(o.animal_location, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography) AS distance_m,
    p.thumbnail_path AS photo_thumbnail_path
  FROM public.individuals i
  JOIN public.observations o ON o.individual_id = i.id
  LEFT JOIN LATERAL (
    SELECT thumbnail_path FROM public.photos ph WHERE ph.observation_id = o.id LIMIT 1
  ) p ON true
  WHERE i.species = p_species
    AND ST_DWithin(o.animal_location, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_m)
  ORDER BY distance_m ASC
  LIMIT 20;
$$;
