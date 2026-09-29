-- ==============================================================================
-- Migration 20260929000002: Global geography (TECHNICAL_REVIEW.md §8.2-8.5)
--
--  1. Worldwide 1 km privacy grid. The previous grid projected every point
--     through UTM zone 32N (EPSG:32632), which is only true-scale around
--     Tunisia: a "1 km" cell measured 528 m in Mumbai and 230 m in Lima, so
--     public locations were up to 4x more precise than promised. The new grid
--     uses 1 km latitude bands and a per-band longitude step, matching
--     generalizeTo1KmGrid() in packages/shared. Existing rows are regenerated
--     from their restricted precise locations.
--  2. country_code / admin1_code / timezone / observed_at_local on every
--     observation, resolved in PostGIS against reference polygons (Natural
--     Earth admin-0/admin-1, timezone-boundary-builder). Load the polygons with
--     supabase/scripts/load_reference_geography.mjs; rows inserted before the
--     load are filled by backfill_observation_geography().
--  3. GBIF taxonomy lookup table and a researcher-facing Darwin Core view.
--
-- Partitioning decision (§8.5): when observations passes ~5M rows, partition
-- by RANGE (observed_at) monthly. Time is the dominant filter in the density
-- RPC and exports; country is better served by the btree index below.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Worldwide 1 km grid
-- ------------------------------------------------------------------------------

-- Grid geometry shared by both functions. Latitude bands are 1 km tall; within
-- a band the longitude step is 1 km at the band's centre latitude, so every
-- cell is ~1 km x 1 km anywhere on Earth. Bands are clamped at +/-85 degrees.
CREATE OR REPLACE FUNCTION public.grid_1km_indices(precise_point GEOMETRY,
    OUT lat_index INTEGER, OUT lon_index INTEGER, OUT lat_step DOUBLE PRECISION, OUT lon_step DOUBLE PRECISION)
AS $$
DECLARE
    v_lat DOUBLE PRECISION := GREATEST(-85.0, LEAST(85.0, ST_Y(precise_point)));
    v_band_centre DOUBLE PRECISION;
BEGIN
    lat_step := 1000.0 / 111000.0;
    lat_index := FLOOR(v_lat / lat_step)::INTEGER;
    v_band_centre := (lat_index + 0.5) * lat_step;
    lon_step := 1000.0 / (111000.0 * cos(radians(v_band_centre)));
    lon_index := FLOOR(ST_X(precise_point) / lon_step)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION public.snap_to_1km_grid_centroid(precise_point GEOMETRY)
RETURNS GEOMETRY AS $$
    SELECT ST_SetSRID(ST_MakePoint(
        round((((g.lon_index + 0.5) * g.lon_step))::NUMERIC, 5)::DOUBLE PRECISION,
        round((((g.lat_index + 0.5) * g.lat_step))::NUMERIC, 5)::DOUBLE PRECISION
    ), 4326)
    FROM public.grid_1km_indices(precise_point) g;
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION public.generate_1km_cell_id(precise_point GEOMETRY)
RETURNS TEXT AS $$
    SELECT '1KM-'
        || CASE WHEN g.lat_index >= 0 THEN 'N' ELSE 'S' END || abs(g.lat_index)::TEXT
        || '-'
        || CASE WHEN g.lon_index >= 0 THEN 'E' ELSE 'W' END || abs(g.lon_index)::TEXT
    FROM public.grid_1km_indices(precise_point) g;
$$ LANGUAGE sql IMMUTABLE STRICT;

-- Regenerate public locations and cell ids from the precise coordinates
UPDATE public.observations o
SET location_public = public.snap_to_1km_grid_centroid(r.location_precise::GEOMETRY),
    grid_cell_id = public.generate_1km_cell_id(r.location_precise::GEOMETRY)
FROM public.observation_locations_restricted r
WHERE r.observation_id = o.id;

-- ------------------------------------------------------------------------------
-- 2. Reference geography
-- ------------------------------------------------------------------------------

-- Polygons are stored subdivided (ST_Subdivide) so point-in-polygon lookups
-- touch small geometries; several rows can share one code.
CREATE TABLE IF NOT EXISTS public.ref_countries (
    id BIGSERIAL PRIMARY KEY,
    iso_a2 CHAR(2) NOT NULL,
    name TEXT NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ref_countries_geom ON public.ref_countries USING GIST (geom);

CREATE TABLE IF NOT EXISTS public.ref_admin1 (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL,           -- ISO 3166-2, e.g. TN-11
    iso_a2 CHAR(2) NOT NULL,
    name TEXT NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ref_admin1_geom ON public.ref_admin1 USING GIST (geom);

CREATE TABLE IF NOT EXISTS public.ref_timezones (
    id BIGSERIAL PRIMARY KEY,
    tzid TEXT NOT NULL,           -- IANA name, e.g. Africa/Tunis
    geom GEOMETRY(Polygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ref_timezones_geom ON public.ref_timezones USING GIST (geom);

ALTER TABLE public.ref_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_admin1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_timezones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reference countries readable" ON public.ref_countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reference admin1 readable" ON public.ref_admin1 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reference timezones readable" ON public.ref_timezones FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.ref_countries, public.ref_admin1, public.ref_timezones TO authenticated;

ALTER TABLE public.observations
    ADD COLUMN IF NOT EXISTS country_code CHAR(2),
    ADD COLUMN IF NOT EXISTS admin1_code TEXT,
    ADD COLUMN IF NOT EXISTS timezone TEXT,
    ADD COLUMN IF NOT EXISTS observed_at_local TIMESTAMP;   -- wall-clock time where the animal was seen
CREATE INDEX IF NOT EXISTS idx_obs_country_observed ON public.observations (country_code, observed_at);
CREATE INDEX IF NOT EXISTS idx_obs_cell_observed ON public.observations (grid_cell_id, observed_at);

ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS country_code CHAR(2),
    ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Country, first-level region and IANA timezone for a point. Points just
-- offshore or on a simplified coastline fall back to the nearest polygon
-- within 10 km. Timezone polygons include oceans, so tz is always set once
-- they are loaded.
CREATE OR REPLACE FUNCTION public.resolve_geography(p GEOMETRY,
    OUT country_code CHAR(2), OUT admin1_code TEXT, OUT timezone TEXT)
AS $$
BEGIN
    SELECT c.iso_a2 INTO country_code FROM public.ref_countries c
    WHERE ST_Intersects(c.geom, p) LIMIT 1;
    IF country_code IS NULL THEN
        SELECT c.iso_a2 INTO country_code FROM public.ref_countries c
        WHERE ST_DWithin(c.geom::GEOGRAPHY, p::GEOGRAPHY, 10000)
        ORDER BY c.geom <-> p LIMIT 1;
    END IF;

    SELECT a.code INTO admin1_code FROM public.ref_admin1 a
    WHERE ST_Intersects(a.geom, p) LIMIT 1;
    IF admin1_code IS NULL THEN
        SELECT a.code INTO admin1_code FROM public.ref_admin1 a
        WHERE ST_DWithin(a.geom::GEOGRAPHY, p::GEOGRAPHY, 10000)
        ORDER BY a.geom <-> p LIMIT 1;
    END IF;

    SELECT t.tzid INTO timezone FROM public.ref_timezones t
    WHERE ST_Intersects(t.geom, p) LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.local_wall_time(p_at TIMESTAMPTZ, p_tz TEXT)
RETURNS TIMESTAMP AS $$
BEGIN
    IF p_at IS NULL OR p_tz IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN p_at AT TIME ZONE p_tz;
EXCEPTION WHEN invalid_parameter_value THEN
    RETURN NULL;   -- tz name unknown to this Postgres build
END;
$$ LANGUAGE plpgsql STABLE;

-- On insert, attribute from the 1 km public point. The restricted-location
-- trigger below refines it from the precise point when that row arrives.
CREATE OR REPLACE FUNCTION public.trg_observations_geography()
RETURNS TRIGGER AS $$
DECLARE
    g RECORD;
BEGIN
    IF NEW.location_public IS NOT NULL AND (NEW.country_code IS NULL OR NEW.timezone IS NULL) THEN
        g := public.resolve_geography(NEW.location_public::GEOMETRY);
        NEW.country_code := COALESCE(NEW.country_code, g.country_code);
        NEW.admin1_code := COALESCE(NEW.admin1_code, g.admin1_code);
        NEW.timezone := COALESCE(NEW.timezone, g.timezone);
    END IF;
    NEW.observed_at_local := public.local_wall_time(NEW.observed_at, NEW.timezone);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, extensions;

DROP TRIGGER IF EXISTS observations_geography ON public.observations;
CREATE TRIGGER observations_geography
    BEFORE INSERT OR UPDATE OF location_public, observed_at, timezone ON public.observations
    FOR EACH ROW EXECUTE FUNCTION public.trg_observations_geography();

CREATE OR REPLACE FUNCTION public.trg_restricted_location_geography()
RETURNS TRIGGER AS $$
DECLARE
    g RECORD;
BEGIN
    g := public.resolve_geography(NEW.location_precise::GEOMETRY);
    UPDATE public.observations
    SET country_code = COALESCE(g.country_code, country_code),
        admin1_code = COALESCE(g.admin1_code, admin1_code),
        timezone = COALESCE(g.timezone, timezone)
    WHERE id = NEW.observation_id;

    UPDATE public.sessions s
    SET country_code = COALESCE(s.country_code, g.country_code),
        timezone = COALESCE(s.timezone, g.timezone)
    FROM public.observations o
    WHERE o.id = NEW.observation_id AND s.id = o.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

DROP TRIGGER IF EXISTS restricted_location_geography ON public.observation_locations_restricted;
CREATE TRIGGER restricted_location_geography
    AFTER INSERT OR UPDATE OF location_precise ON public.observation_locations_restricted
    FOR EACH ROW EXECUTE FUNCTION public.trg_restricted_location_geography();

-- Sessions with a track (including zero-animal checklists) take their
-- attribution from the start of the walk.
CREATE OR REPLACE FUNCTION public.trg_sessions_geography()
RETURNS TRIGGER AS $$
DECLARE
    g RECORD;
BEGIN
    IF NEW.track IS NOT NULL AND (NEW.country_code IS NULL OR NEW.timezone IS NULL) THEN
        g := public.resolve_geography(ST_StartPoint(NEW.track::GEOMETRY));
        NEW.country_code := COALESCE(NEW.country_code, g.country_code);
        NEW.timezone := COALESCE(NEW.timezone, g.timezone);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, extensions;

DROP TRIGGER IF EXISTS sessions_geography ON public.sessions;
CREATE TRIGGER sessions_geography
    BEFORE INSERT OR UPDATE OF track ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public.trg_sessions_geography();

-- Fills rows inserted before the reference polygons were loaded, or all rows
-- when p_force is true (e.g. after a boundary update). Returns rows updated.
CREATE OR REPLACE FUNCTION public.backfill_observation_geography(p_force BOOLEAN DEFAULT false)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.observations o
    SET country_code = g.country_code,
        admin1_code = g.admin1_code,
        timezone = g.timezone
    FROM public.observation_locations_restricted r,
         LATERAL public.resolve_geography(r.location_precise::GEOMETRY) g
    WHERE r.observation_id = o.id
      AND (p_force OR o.country_code IS NULL OR o.timezone IS NULL);
    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.sessions s
    SET country_code = COALESCE(s.country_code, o.country_code),
        timezone = COALESCE(s.timezone, o.timezone)
    FROM (
        SELECT DISTINCT ON (session_id) session_id, country_code, timezone
        FROM public.observations
        WHERE country_code IS NOT NULL
        ORDER BY session_id, observed_at
    ) o
    WHERE s.id = o.session_id AND (s.country_code IS NULL OR s.timezone IS NULL);

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE ALL ON FUNCTION public.backfill_observation_geography(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_observation_geography(BOOLEAN) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. Taxonomy and Darwin Core view
-- ------------------------------------------------------------------------------

-- GBIF backbone keys verified against api.gbif.org/v1/species/match
CREATE TABLE IF NOT EXISTS public.ref_taxa (
    species TEXT PRIMARY KEY,         -- value stored in observations.species
    scientific_name TEXT NOT NULL,
    taxon_rank TEXT NOT NULL,
    gbif_taxon_key INTEGER NOT NULL,
    vernacular_name TEXT NOT NULL
);
INSERT INTO public.ref_taxa VALUES
    ('cat', 'Felis catus Linnaeus, 1758', 'species', 2435035, 'domestic cat'),
    ('dog', 'Canis lupus familiaris Linnaeus, 1758', 'subspecies', 6164210, 'domestic dog'),
    ('unknown', 'Carnivora', 'order', 732, 'unidentified carnivore')
ON CONFLICT (species) DO UPDATE SET
    scientific_name = EXCLUDED.scientific_name,
    taxon_rank = EXCLUDED.taxon_rank,
    gbif_taxon_key = EXCLUDED.gbif_taxon_key,
    vernacular_name = EXCLUDED.vernacular_name;
ALTER TABLE public.ref_taxa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Taxa readable" ON public.ref_taxa FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.ref_taxa TO anon, authenticated;

-- Generalised (1 km) Darwin Core occurrences. security_invoker keeps the
-- caller's RLS in force; precise coordinates are never part of this view.
CREATE OR REPLACE VIEW public.dwc_occurrence
WITH (security_invoker = true) AS
SELECT
    o.id AS "occurrenceID",
    'HumanObservation' AS "basisOfRecord",
    o.session_id AS "eventID",
    o.observed_at AS "eventDate",
    o.observed_at_local AS "eventLocalDateTime",
    o.timezone AS "eventTimeZone",
    t.scientific_name AS "scientificName",
    t.taxon_rank AS "taxonRank",
    t.gbif_taxon_key AS "taxonKey",
    t.vernacular_name AS "vernacularName",
    o.group_size AS "individualCount",
    o.country_code AS "countryCode",
    o.admin1_code AS "stateProvince",
    ST_Y(o.location_public) AS "decimalLatitude",
    ST_X(o.location_public) AS "decimalLongitude",
    'EPSG:4326' AS "geodeticDatum",
    707 AS "coordinateUncertaintyInMeters",
    'Generalised to the centroid of a 1 km grid cell' AS "dataGeneralizations",
    s.protocol AS "samplingProtocol",
    CASE WHEN s.distance_km IS NOT NULL
         THEN s.distance_km::TEXT || ' km; ' || COALESCE(s.duration_min, 0)::TEXT || ' min'
    END AS "samplingEffort",
    s.complete_session AS "isCompleteChecklist",
    o.distance_from_path_m AS "perpendicularDistanceM",
    o.grid_cell_id AS "gridCellID"
FROM public.observations o
JOIN public.sessions s ON s.id = o.session_id
LEFT JOIN public.ref_taxa t ON t.species = o.species
WHERE s.validation_status <> 'flagged';

GRANT SELECT ON public.dwc_occurrence TO authenticated;
