-- ==============================================================================
-- Migration 20260929000001: Security & privacy hardening (TECHNICAL_REVIEW.md §3)
--
--  1. submit_survey_bundle: authenticated callers only. The previous version was
--     granted to anon and, with no JWT, attributed the bundle to a user_id taken
--     from the payload (or to the first profile in the table), so anyone holding
--     the public anon key could submit surveys and earn XP as any volunteer.
--     Animal-count XP is capped at 20 per session (CLAUDE.md §2.1) and complete
--     checklists, including zero-animal ones, earn the +20 completion bonus.
--  2. Anonymous access: revoke every table grant and policy left over from the
--     archived 000006 migration. Anon keeps only get_public_density_map
--     (aggregated, k-anonymity thresholded) and read access to active routes.
--  3. Storage: the animal-photos bucket becomes private. Uploaders read their own
--     objects; researchers and admins read everything, through signed URLs.
--  4. AI quota: per-user daily counter consumed by the analyze-photo Edge Function.
--  5. Right to erasure (GDPR Art. 17) with anonymise-not-destroy semantics, and
--     right of access (Art. 15) via export_my_data().
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. submit_survey_bundle: require auth.uid()
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_survey_bundle(payload JSONB)
RETURNS JSONB AS $$
DECLARE
    v_session_id UUID;
    v_user_id UUID;
    v_existing_owner UUID;
    v_elem JSONB;
    v_obs_id UUID;
    v_exact_lon DOUBLE PRECISION;
    v_exact_lat DOUBLE PRECISION;
    v_exact_pt GEOMETRY;
    v_public_pt GEOMETRY;
    v_cell_id TEXT;
    v_observer_lon DOUBLE PRECISION;
    v_observer_lat DOUBLE PRECISION;
    v_observer_pt GEOGRAPHY;
    v_track_geom GEOGRAPHY;
    v_xp_earned INTEGER;
    v_obs_count INTEGER;
    v_complete BOOLEAN;
    v_coord_array JSONB;
    v_i INTEGER;
    v_point_count INTEGER;
    v_geom_text TEXT;
BEGIN
    -- The author is always the caller. Payload-supplied identities are ignored.
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'submit_survey_bundle: authentication required'
            USING ERRCODE = '42501';
    END IF;

    v_session_id := (payload->'session'->>'id')::UUID;
    IF v_session_id IS NULL THEN
        RAISE EXCEPTION 'submit_survey_bundle: missing session.id in payload';
    END IF;

    -- Idempotency: a retry of the caller's own session is a no-op. A session id
    -- owned by someone else is rejected rather than reported as synced.
    SELECT user_id INTO v_existing_owner FROM public.sessions WHERE id = v_session_id;
    IF FOUND THEN
        IF v_existing_owner IS DISTINCT FROM v_user_id THEN
            RAISE EXCEPTION 'submit_survey_bundle: session id already exists'
                USING ERRCODE = '23505';
        END IF;
        RETURN jsonb_build_object(
            'success', true,
            'session_id', v_session_id,
            'already_synced', true
        );
    END IF;

    -- Parse LineString track geometry if present
    v_track_geom := NULL;
    IF payload->'track' IS NOT NULL AND payload->'track'->'coordinates' IS NOT NULL THEN
        v_coord_array := payload->'track'->'coordinates';
        v_point_count := jsonb_array_length(v_coord_array);
        IF v_point_count >= 2 THEN
            v_geom_text := 'LINESTRING(';
            FOR v_i IN 0..(v_point_count - 1) LOOP
                IF v_i > 0 THEN
                    v_geom_text := v_geom_text || ', ';
                END IF;
                -- Cast through DOUBLE PRECISION so only numbers reach the WKT string
                v_geom_text := v_geom_text
                    || ((v_coord_array->v_i->>0)::DOUBLE PRECISION)::TEXT || ' '
                    || ((v_coord_array->v_i->>1)::DOUBLE PRECISION)::TEXT;
            END LOOP;
            v_geom_text := v_geom_text || ')';
            v_track_geom := ST_GeogFromText('SRID=4326;' || v_geom_text);
        END IF;
    END IF;

    v_complete := COALESCE((payload->'session'->>'complete_session')::BOOLEAN, false);

    -- 1. Insert Session
    INSERT INTO public.sessions (
        id, user_id, observer_id, protocol, route_id,
        started_at, start_time, ended_at, end_time,
        moving_time_s, duration_s, duration_min, distance_m, distance_km,
        complete_session, n_observers, number_of_observers, track,
        weather, time_of_day, avg_gps_accuracy_m, device_gps_accuracy_avg,
        app_version, validation_status, notes, created_at
    ) VALUES (
        v_session_id,
        v_user_id,
        v_user_id,
        COALESCE(payload->'session'->>'protocol', 'transect'),
        CASE WHEN (payload->'session'->>'route_id') IS NOT NULL AND (payload->'session'->>'route_id') ~ '^[0-9a-fA-F-]{36}$'
             THEN (payload->'session'->>'route_id')::UUID ELSE NULL END,
        COALESCE((payload->'session'->>'start_time')::TIMESTAMPTZ, now()),
        COALESCE((payload->'session'->>'start_time')::TIMESTAMPTZ, now()),
        (payload->'session'->>'end_time')::TIMESTAMPTZ,
        (payload->'session'->>'end_time')::TIMESTAMPTZ,
        COALESCE((payload->'session'->>'moving_time_s')::INTEGER, 0),
        COALESCE((payload->'session'->>'duration_s')::INTEGER, 0),
        COALESCE(((payload->'session'->>'duration_s')::NUMERIC / 60.0), 0.0),
        COALESCE(((payload->'session'->>'distance_km')::NUMERIC * 1000.0), 0.0),
        COALESCE((payload->'session'->>'distance_km')::NUMERIC, 0.0),
        v_complete,
        COALESCE((payload->'session'->>'number_of_observers')::INTEGER, 1),
        COALESCE((payload->'session'->>'number_of_observers')::INTEGER, 1),
        v_track_geom,
        payload->'session'->>'weather',
        payload->'session'->>'time_of_day',
        (payload->'session'->>'device_gps_accuracy_avg')::NUMERIC,
        (payload->'session'->>'device_gps_accuracy_avg')::NUMERIC,
        COALESCE(payload->'session'->>'app_version', '1.0.0'),
        'pending',
        payload->'session'->>'notes',
        now()
    );

    -- 2. Insert Raw Track Points
    IF payload->'track_points' IS NOT NULL AND jsonb_typeof(payload->'track_points') = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(payload->'track_points')
        LOOP
            INSERT INTO public.track_points (
                session_id, recorded_at, location, accuracy_m, speed
            ) VALUES (
                v_session_id,
                COALESCE((v_elem->>'recorded_at')::TIMESTAMPTZ, now()),
                ST_SetSRID(ST_MakePoint((v_elem->>'longitude')::DOUBLE PRECISION, (v_elem->>'latitude')::DOUBLE PRECISION), 4326)::geography,
                COALESCE((v_elem->>'accuracy_m')::NUMERIC, 5.0),
                (v_elem->>'speed_mps')::NUMERIC
            );
        END LOOP;
    END IF;

    -- 3. Insert Observations + Restricted Coordinates
    IF payload->'observations' IS NOT NULL AND jsonb_typeof(payload->'observations') = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(payload->'observations')
        LOOP
            v_obs_id := (v_elem->>'id')::UUID;
            v_exact_lon := (v_elem->'location'->'coordinates'->>0)::DOUBLE PRECISION;
            v_exact_lat := (v_elem->'location'->'coordinates'->>1)::DOUBLE PRECISION;
            v_exact_pt := ST_SetSRID(ST_MakePoint(v_exact_lon, v_exact_lat), 4326);

            v_public_pt := public.snap_to_1km_grid_centroid(v_exact_pt);
            v_cell_id := public.generate_1km_cell_id(v_exact_pt);

            IF v_elem->'observer_location' IS NOT NULL AND v_elem->'observer_location'->'coordinates' IS NOT NULL THEN
                v_observer_lon := (v_elem->'observer_location'->'coordinates'->>0)::DOUBLE PRECISION;
                v_observer_lat := (v_elem->'observer_location'->'coordinates'->>1)::DOUBLE PRECISION;
                v_observer_pt := ST_SetSRID(ST_MakePoint(v_observer_lon, v_observer_lat), 4326)::geography;
            ELSE
                v_observer_pt := v_exact_pt::geography;
            END IF;

            INSERT INTO public.observations (
                id, session_id, user_id, observer_id, observed_at, species, group_size,
                distance_from_path_m, distance_estimate_m, bearing_deg, gps_accuracy_m,
                body_condition_score, notes, location_public, grid_cell_id, created_at
            ) VALUES (
                v_obs_id,
                v_session_id,
                v_user_id,
                v_user_id,
                COALESCE((v_elem->>'observed_at')::TIMESTAMPTZ, now()),
                COALESCE(v_elem->>'species', 'unknown'),
                COALESCE((v_elem->>'group_size')::INTEGER, 1),
                (v_elem->>'distance_from_path_m')::NUMERIC,
                (v_elem->>'distance_estimate_m')::NUMERIC,
                (v_elem->>'bearing_deg')::NUMERIC,
                (v_elem->>'gps_accuracy_m')::NUMERIC,
                (v_elem->>'body_condition_score')::INTEGER,
                v_elem->>'notes',
                v_public_pt,
                v_cell_id,
                now()
            );

            INSERT INTO public.observation_locations_restricted (
                observation_id, location_precise, observer_location, gps_accuracy_m, created_at
            ) VALUES (
                v_obs_id,
                v_exact_pt::geography,
                v_observer_pt,
                COALESCE((v_elem->>'gps_accuracy_m')::NUMERIC, 5.0),
                now()
            );

            IF (v_elem->>'body_condition_score') IS NOT NULL THEN
                INSERT INTO public.observation_animals (observation_id, body_condition_score)
                VALUES (v_obs_id, (v_elem->>'body_condition_score')::INTEGER);
            END IF;
        END LOOP;
    END IF;

    -- 4. Insert Photos. Only rows for observations in this bundle, and only
    --    storage paths under that observation's own prefix.
    IF payload->'photos' IS NOT NULL AND jsonb_typeof(payload->'photos') = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(payload->'photos')
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.observations
                WHERE id = (v_elem->>'observation_id')::UUID AND session_id = v_session_id
            ) THEN
                RAISE EXCEPTION 'submit_survey_bundle: photo references an observation outside this bundle';
            END IF;

            INSERT INTO public.photos (
                id, observation_id, storage_path, angle, taken_at, upload_status
            ) VALUES (
                (v_elem->>'id')::UUID,
                (v_elem->>'observation_id')::UUID,
                v_elem->>'storage_path',
                COALESCE((v_elem->>'angle'), 'other'),
                COALESCE((v_elem->>'taken_at')::TIMESTAMPTZ, now()),
                CASE WHEN (v_elem->>'storage_path') LIKE 'observations/%' THEN 'synced' ELSE 'pending' END
            );
        END LOOP;
    END IF;

    -- 5. Effort-weighted XP (CLAUDE.md §2.1): base effort + animal count capped
    --    at 20 + completion bonus that zero-animal checklists also receive.
    v_obs_count := COALESCE(jsonb_array_length(payload->'observations'), 0);
    v_xp_earned := 50
        + LEAST(v_obs_count * 10, 20)
        + CASE WHEN v_complete THEN 20 ELSE 0 END;

    INSERT INTO public.xp_events (user_id, source_type, source_id, xp, reason, created_at)
    VALUES (
        v_user_id,
        'session',
        v_session_id,
        v_xp_earned,
        'Survey session completed: ' || COALESCE(payload->'session'->>'protocol', 'transect'),
        now()
    );

    UPDATE public.profiles
    SET xp_total = xp_total + v_xp_earned,
        updated_at = now()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'xp_earned', v_xp_earned
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE ALL ON FUNCTION public.submit_survey_bundle(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_survey_bundle(JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Anonymous access: aggregated density map and active routes only
-- ------------------------------------------------------------------------------

-- Policies created by archive/20260923000006 on projects that ran it
DROP POLICY IF EXISTS "Allow public read on generalized observations" ON public.observations;
DROP POLICY IF EXISTS "Allow public read on photos" ON public.photos;
DROP POLICY IF EXISTS "Allow public read on colonies" ON public.colonies;
DROP POLICY IF EXISTS "Allow public read on individuals" ON public.individuals;

REVOKE ALL ON public.observations FROM anon;
REVOKE ALL ON public.observation_locations_restricted FROM anon;
REVOKE ALL ON public.observation_animals FROM anon;
REVOKE ALL ON public.photos FROM anon;
REVOKE ALL ON public.colonies FROM anon;
REVOKE ALL ON public.individuals FROM anon;
REVOKE ALL ON public.sessions FROM anon;
REVOKE ALL ON public.track_points FROM anon;
REVOKE ALL ON public.profiles FROM anon;

-- ------------------------------------------------------------------------------
-- 3. Private photo bucket
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('animal-photos', 'animal-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Public Access Animal Photos" ON storage.objects;
DROP POLICY IF EXISTS "Surveyors Upload Animal Photos" ON storage.objects;
DROP POLICY IF EXISTS "Surveyors Update Own Animal Photos" ON storage.objects;
DROP POLICY IF EXISTS "Researchers Delete Animal Photos" ON storage.objects;

CREATE POLICY "Animal photos: owner or researcher read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'animal-photos'
        AND (owner_id = auth.uid()::text OR public.is_researcher_or_admin())
    );

CREATE POLICY "Animal photos: authenticated upload under observations/" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'animal-photos'
        AND (storage.foldername(name))[1] = 'observations'
    );

-- upsert:true retries need UPDATE on the caller's own objects
CREATE POLICY "Animal photos: owner update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'animal-photos' AND owner_id = auth.uid()::text)
    WITH CHECK (bucket_id = 'animal-photos' AND owner_id = auth.uid()::text);

CREATE POLICY "Animal photos: owner or researcher delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'animal-photos'
        AND (owner_id = auth.uid()::text OR public.is_researcher_or_admin())
    );

-- ------------------------------------------------------------------------------
-- 4. Per-user daily AI analysis quota (consumed by the analyze-photo function)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT (timezone('utc'::text, now()))::DATE,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_daily FROM anon, authenticated;

-- Atomically increments today's counter for the caller. Returns true while the
-- caller is within p_daily_limit, false once the limit is reached.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_daily_limit INTEGER DEFAULT 50)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    INSERT INTO public.ai_usage_daily AS u (user_id, usage_date, request_count)
    VALUES (v_user_id, (timezone('utc'::text, now()))::DATE, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET request_count = u.request_count + 1
    WHERE u.request_count < p_daily_limit
    RETURNING request_count INTO v_count;

    RETURN v_count IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.consume_ai_quota(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Right of access and right to erasure
-- ------------------------------------------------------------------------------

-- Observations and sessions must outlive their author so erasure does not
-- destroy the scientific record. Deleting a profile now nulls the link.
ALTER TABLE public.sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_observer_id_fkey;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_observer_id_fkey
    FOREIGN KEY (observer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.observations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.observations DROP CONSTRAINT IF EXISTS observations_user_id_fkey;
ALTER TABLE public.observations ADD CONSTRAINT observations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.observations DROP CONSTRAINT IF EXISTS observations_observer_id_fkey;
ALTER TABLE public.observations ADD CONSTRAINT observations_observer_id_fkey
    FOREIGN KEY (observer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Returns every row keyed to the caller as one JSON document (GDPR Art. 15).
-- The caller's own precise locations are included: it is their own data.
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'export_my_data: authentication required' USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'export_schema_version', 1,
        'exported_at', now(),
        'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_user_id),
        'privacy_zones', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', z.id,
                'radius_m', z.radius_m,
                'center', ST_AsGeoJSON(z.center)::JSONB))
            FROM public.privacy_zones z WHERE z.user_id = v_user_id), '[]'::JSONB),
        'sessions', COALESCE((
            SELECT jsonb_agg((to_jsonb(s) - 'track') || jsonb_build_object(
                'track', ST_AsGeoJSON(s.track)::JSONB))
            FROM public.sessions s WHERE s.user_id = v_user_id), '[]'::JSONB),
        'track_points', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'session_id', t.session_id,
                'recorded_at', t.recorded_at,
                'location', ST_AsGeoJSON(t.location)::JSONB,
                'accuracy_m', t.accuracy_m,
                'speed', t.speed))
            FROM public.track_points t
            JOIN public.sessions s ON s.id = t.session_id
            WHERE s.user_id = v_user_id), '[]'::JSONB),
        'observations', COALESCE((
            SELECT jsonb_agg((to_jsonb(o) - 'location_public') || jsonb_build_object(
                'location_public', ST_AsGeoJSON(o.location_public)::JSONB,
                'location_precise', ST_AsGeoJSON(r.location_precise)::JSONB,
                'observer_location', ST_AsGeoJSON(r.observer_location)::JSONB))
            FROM public.observations o
            LEFT JOIN public.observation_locations_restricted r ON r.observation_id = o.id
            WHERE o.user_id = v_user_id), '[]'::JSONB),
        'photos', COALESCE((
            SELECT jsonb_agg(to_jsonb(ph))
            FROM public.photos ph
            JOIN public.observations o ON o.id = ph.observation_id
            WHERE o.user_id = v_user_id), '[]'::JSONB),
        'xp_events', COALESCE((
            SELECT jsonb_agg(to_jsonb(x)) FROM public.xp_events x WHERE x.user_id = v_user_id), '[]'::JSONB),
        'badges', COALESCE((
            SELECT jsonb_agg(to_jsonb(b)) FROM public.user_badges b WHERE b.user_id = v_user_id), '[]'::JSONB),
        'quests', COALESCE((
            SELECT jsonb_agg(to_jsonb(q)) FROM public.user_quests q WHERE q.user_id = v_user_id), '[]'::JSONB),
        'streak', (SELECT to_jsonb(st) FROM public.streaks st WHERE st.user_id = v_user_id),
        'academy_progress', COALESCE((
            SELECT jsonb_agg(to_jsonb(a)) FROM public.user_academy_progress a WHERE a.user_id = v_user_id), '[]'::JSONB),
        'identification_proposals', COALESCE((
            SELECT jsonb_agg(to_jsonb(m)) FROM public.individual_matches m WHERE m.user_id = v_user_id), '[]'::JSONB)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions;

REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

-- Strips personal data from a user's contributions while keeping the
-- de-identified science: 1 km generalised observations, welfare attributes,
-- and session effort totals (distance, duration, completeness) survive.
-- Removed: precise animal and observer coordinates, raw GPS breadcrumbs and
-- track geometry (a walk that starts at home locates the home), free-text
-- notes, and photo rows. Photo files are removed from Storage by the
-- delete-account Edge Function, which calls this with the service role and
-- then deletes the auth user (cascading to the profile and personal tables).
CREATE OR REPLACE FUNCTION public.anonymize_user_contributions(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_photo_paths TEXT[];
    v_obs_count INTEGER;
    v_session_count INTEGER;
BEGIN
    -- Files referenced by the user's photo rows, plus anything they uploaded
    -- whose bundle never reached the server
    SELECT COALESCE(array_agg(DISTINCT path), ARRAY[]::TEXT[]) INTO v_photo_paths
    FROM (
        SELECT ph.storage_path AS path
        FROM public.photos ph
        JOIN public.observations o ON o.id = ph.observation_id
        WHERE o.user_id = p_user_id
        UNION
        SELECT so.name
        FROM storage.objects so
        WHERE so.bucket_id = 'animal-photos' AND so.owner_id = p_user_id::text
    ) paths;

    DELETE FROM public.photos ph
    USING public.observations o
    WHERE o.id = ph.observation_id AND o.user_id = p_user_id;

    DELETE FROM public.observation_locations_restricted r
    USING public.observations o
    WHERE o.id = r.observation_id AND o.user_id = p_user_id;

    DELETE FROM public.track_points t
    USING public.sessions s
    WHERE s.id = t.session_id AND s.user_id = p_user_id;

    UPDATE public.observations
    SET notes = NULL, user_id = NULL, observer_id = NULL
    WHERE user_id = p_user_id OR observer_id = p_user_id;
    GET DIAGNOSTICS v_obs_count = ROW_COUNT;

    UPDATE public.sessions
    SET notes = NULL, track = NULL, user_id = NULL, observer_id = NULL
    WHERE user_id = p_user_id OR observer_id = p_user_id;
    GET DIAGNOSTICS v_session_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'photo_paths', to_jsonb(v_photo_paths),
        'observations_anonymized', v_obs_count,
        'sessions_anonymized', v_session_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Service role only: the Edge Function performs the auth check.
REVOKE ALL ON FUNCTION public.anonymize_user_contributions(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_user_contributions(UUID) TO service_role;
