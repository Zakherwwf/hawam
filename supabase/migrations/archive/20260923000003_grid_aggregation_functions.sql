-- Migration 000003: Public Aggregated Density Map with Minimum Count Threshold
-- Citizen-Science App for Free-Roaming Cats & Dogs (Tunisia)

-- Returns 1 km grid cells with count >= min_threshold (k-anonymity)
-- NEVER returns individual coordinates; cells with counts below threshold are suppressed
CREATE OR REPLACE FUNCTION public.get_public_density_map(
    min_count_threshold INTEGER DEFAULT 3,
    filter_species animal_species DEFAULT NULL,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    grid_cell_id TEXT,
    centroid_lon NUMERIC,
    centroid_lat NUMERIC,
    observation_count BIGINT,
    total_individuals BIGINT,
    dominant_species TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.grid_cell_id,
        ROUND(ST_X(ST_Centroid(ST_Union(o.location_public)))::NUMERIC, 5) AS centroid_lon,
        ROUND(ST_Y(ST_Centroid(ST_Union(o.location_public)))::NUMERIC, 5) AS centroid_lat,
        COUNT(*)::BIGINT AS observation_count,
        SUM(o.group_size)::BIGINT AS total_individuals,
        MODE() WITHIN GROUP (ORDER BY o.species::TEXT) AS dominant_species
    FROM public.observations o
    WHERE 
        (filter_species IS NULL OR o.species = filter_species)
        AND (start_date IS NULL OR o.observed_at >= start_date)
        AND (end_date IS NULL OR o.observed_at <= end_date)
    GROUP BY o.grid_cell_id
    HAVING COUNT(*) >= min_count_threshold;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Safe insertion RPC that accepts an observation with its exact coordinates,
-- automatically calculates the 1 km generalized public location,
-- writes the generalized record to `observations`, and writes the exact coordinates
-- to `observation_locations_restricted` atomically in a single transaction.
CREATE OR REPLACE FUNCTION public.submit_observation(
    p_session_id UUID,
    p_observed_at TIMESTAMPTZ,
    p_exact_lon NUMERIC,
    p_exact_lat NUMERIC,
    p_gps_accuracy_m NUMERIC,
    p_species animal_species,
    p_group_size INTEGER,
    p_distance_from_path_m NUMERIC,
    p_sex animal_sex,
    p_age_class animal_age_class,
    p_reproductive_status animal_reproductive_status,
    p_body_condition_score INTEGER,
    p_visible_health_issues TEXT[],
    p_ear_tip_or_notch yes_no_unknown,
    p_collar_or_tag yes_no_unknown,
    p_behaviour animal_behaviour,
    p_being_fed_by_people yes_no_unknown,
    p_habitat_type TEXT,
    p_food_sources_visible TEXT[],
    p_notes TEXT
)
RETURNS UUID AS $$
DECLARE
    v_obs_id UUID;
    v_exact_point GEOMETRY;
    v_public_point GEOMETRY;
    v_cell_id TEXT;
BEGIN
    v_exact_point := ST_SetSRID(ST_MakePoint(p_exact_lon, p_exact_lat), 4326);
    
    -- Compute 1 km grid centroid and Cell ID
    v_public_point := public.snap_to_1km_grid_centroid(v_exact_point);
    v_cell_id := public.generate_1km_cell_id(v_exact_point);

    -- 1. Insert into public observations
    INSERT INTO public.observations (
        session_id,
        observer_id,
        observed_at,
        location_public,
        grid_cell_id,
        species,
        group_size,
        distance_from_path_m,
        sex,
        age_class,
        reproductive_status,
        body_condition_score,
        visible_health_issues,
        ear_tip_or_notch,
        collar_or_tag,
        behaviour,
        being_fed_by_people,
        habitat_type,
        food_sources_visible,
        notes
    ) VALUES (
        p_session_id,
        auth.uid(),
        p_observed_at,
        v_public_point,
        v_cell_id,
        p_species,
        p_group_size,
        p_distance_from_path_m,
        p_sex,
        p_age_class,
        p_reproductive_status,
        p_body_condition_score,
        p_visible_health_issues,
        p_ear_tip_or_notch,
        p_collar_or_tag,
        p_behaviour,
        p_being_fed_by_people,
        p_habitat_type,
        p_food_sources_visible,
        p_notes
    ) RETURNING id INTO v_obs_id;

    -- 2. Insert into restricted location table
    INSERT INTO public.observation_locations_restricted (
        observation_id,
        location_precise,
        gps_accuracy_m
    ) VALUES (
        v_obs_id,
        v_exact_point,
        p_gps_accuracy_m
    );

    RETURN v_obs_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
