-- Migration 000001: Core PostGIS Schema, Types, Tables & Functions
-- Citizen-Science App for Free-Roaming Cats & Dogs (Tunisia)

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enumerated Types
CREATE TYPE user_role AS ENUM ('volunteer', 'trained_surveyor', 'researcher', 'admin');
CREATE TYPE survey_protocol AS ENUM ('transect', 'stationary_point', 'incidental');
CREATE TYPE animal_species AS ENUM ('cat', 'dog', 'unknown');
CREATE TYPE animal_sex AS ENUM ('male', 'female', 'unknown');
CREATE TYPE animal_age_class AS ENUM ('juvenile', 'adult', 'unknown');
CREATE TYPE animal_reproductive_status AS ENUM ('lactating', 'visibly_pregnant', 'none_visible', 'unknown');
CREATE TYPE yes_no_unknown AS ENUM ('yes', 'no', 'unknown');
CREATE TYPE animal_behaviour AS ENUM ('approachable', 'neutral', 'fearful', 'aggressive');
CREATE TYPE photo_angle AS ENUM ('left_flank', 'right_flank', 'face', 'other');
CREATE TYPE coat_pattern AS ENUM ('tabby', 'bicolour_piebald', 'tortoiseshell_calico', 'solid_black', 'solid_other', 'other');
CREATE TYPE match_status AS ENUM ('proposed', 'confirmed', 'rejected');
CREATE TYPE match_method AS ENUM ('human', 'algorithm');
CREATE TYPE weather_condition AS ENUM ('clear', 'cloudy', 'rain', 'wind');
CREATE TYPE time_of_day_enum AS ENUM ('dawn', 'morning', 'afternoon', 'dusk', 'night');

-- 3. Core Tables

-- Users Profile Table (Extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'volunteer',
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'ar',
    consent_version_accepted VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Predefined Fixed Routes for Repeat Surveys
CREATE TABLE public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    geometry GEOMETRY(LineString, 4326) NOT NULL,
    governorate TEXT NOT NULL,
    delegation TEXT NOT NULL,
    habitat_notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Survey Sessions (Effort Metadata and Checklists)
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observer_id UUID NOT NULL REFERENCES public.users(id),
    protocol survey_protocol NOT NULL,
    route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    duration_min NUMERIC(6, 2),
    track GEOMETRY(LineString, 4326),
    distance_km NUMERIC(6, 3),
    complete_session BOOLEAN NOT NULL DEFAULT false,
    number_of_observers INTEGER NOT NULL DEFAULT 1 CHECK (number_of_observers >= 1),
    weather weather_condition,
    time_of_day time_of_day_enum,
    app_version TEXT NOT NULL DEFAULT '1.0.0',
    device_gps_accuracy_avg NUMERIC(6, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalogue of Confirmed Individuals (for Photo-ID & Capture-Recapture)
CREATE TABLE public.individuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species animal_species NOT NULL,
    coat_description TEXT NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Observations Table (Contains PUBLIC / GENERALIZED Locations Only)
CREATE TABLE public.observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    observer_id UUID NOT NULL REFERENCES public.users(id),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Public generalized location (~1 km grid centroid)
    location_public GEOMETRY(Point, 4326) NOT NULL,
    grid_cell_id TEXT NOT NULL,
    
    species animal_species NOT NULL,
    group_size INTEGER NOT NULL DEFAULT 1 CHECK (group_size >= 1),
    distance_from_path_m NUMERIC(6, 2) CHECK (distance_from_path_m >= 0),
    
    -- Per-Animal Scientific Attributes
    sex animal_sex NOT NULL DEFAULT 'unknown',
    age_class animal_age_class NOT NULL DEFAULT 'unknown',
    reproductive_status animal_reproductive_status NOT NULL DEFAULT 'unknown',
    body_condition_score INTEGER NOT NULL CHECK (body_condition_score BETWEEN 1 AND 5),
    visible_health_issues TEXT[] NOT NULL DEFAULT '{}',
    ear_tip_or_notch yes_no_unknown NOT NULL DEFAULT 'unknown',
    collar_or_tag yes_no_unknown NOT NULL DEFAULT 'unknown',
    behaviour animal_behaviour NOT NULL DEFAULT 'neutral',
    being_fed_by_people yes_no_unknown NOT NULL DEFAULT 'unknown',
    habitat_type TEXT NOT NULL,
    food_sources_visible TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    linked_individual_id UUID REFERENCES public.individuals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RESTRICTED TABLE: Holds exact GPS coordinates (ACCESSIBLE ONLY TO RESEARCHER & ADMIN)
CREATE TABLE public.observation_locations_restricted (
    observation_id UUID PRIMARY KEY REFERENCES public.observations(id) ON DELETE CASCADE,
    location_precise GEOMETRY(Point, 4326) NOT NULL,
    gps_accuracy_m NUMERIC(6, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Animal Photos Table
CREATE TABLE public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    angle photo_angle NOT NULL,
    coat_pattern coat_pattern,
    taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photo Matching Table for Individual Re-identification
CREATE TABLE public.individual_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_a UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
    photo_b UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
    method match_method NOT NULL DEFAULT 'human',
    score NUMERIC(4, 3) NOT NULL DEFAULT 1.000 CHECK (score BETWEEN 0 AND 1),
    status match_status NOT NULL DEFAULT 'proposed',
    reviewer_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log for Researcher Exports of Sensitive Data
CREATE TABLE public.export_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    export_type TEXT NOT NULL,
    row_count INTEGER NOT NULL CHECK (row_count >= 0),
    precise_location_included BOOLEAN NOT NULL DEFAULT false,
    query_params JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Spatial Indexes
CREATE INDEX idx_routes_geom ON public.routes USING GIST (geometry);
CREATE INDEX idx_sessions_track ON public.sessions USING GIST (track);
CREATE INDEX idx_obs_location_public ON public.observations USING GIST (location_public);
CREATE INDEX idx_obs_locations_precise ON public.observation_locations_restricted USING GIST (location_precise);
CREATE INDEX idx_obs_grid_cell ON public.observations (grid_cell_id);
CREATE INDEX idx_obs_species ON public.observations (species);
CREATE INDEX idx_obs_session_id ON public.observations (session_id);

-- 5. PostGIS 1 km Grid Generalization Function
-- Snaps any EPSG:4326 point into its 1 km grid centroid using metric UTM Zone 32N (Tunisia EPSG:32632)
CREATE OR REPLACE FUNCTION public.snap_to_1km_grid_centroid(precise_point GEOMETRY)
RETURNS GEOMETRY AS $$
DECLARE
    utm_geom GEOMETRY;
    snapped_utm GEOMETRY;
    centroid_4326 GEOMETRY;
BEGIN
    -- Project to UTM Zone 32N (meters)
    utm_geom := ST_Transform(precise_point, 32632);
    -- Snap to 1000m grid origin and take cell centroid (+500m X and Y)
    snapped_utm := ST_Translate(ST_SnapToGrid(utm_geom, 1000), 500, 500);
    -- Project back to WGS 84 (EPSG:4326)
    centroid_4326 := ST_Transform(snapped_utm, 4326);
    RETURN centroid_4326;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Function to generate standard 1 km Grid Cell Identifier
CREATE OR REPLACE FUNCTION public.generate_1km_cell_id(precise_point GEOMETRY)
RETURNS TEXT AS $$
DECLARE
    utm_geom GEOMETRY;
    x_cell INTEGER;
    y_cell INTEGER;
BEGIN
    utm_geom := ST_Transform(precise_point, 32632);
    x_cell := FLOOR(ST_X(utm_geom) / 1000.0)::INTEGER;
    y_cell := FLOOR(ST_Y(utm_geom) / 1000.0)::INTEGER;
    RETURN 'TUN-32N-1KM-' || x_cell::TEXT || '-' || y_cell::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;
