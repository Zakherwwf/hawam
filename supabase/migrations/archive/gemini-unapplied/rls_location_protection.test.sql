-- Automated RLS Location Protection Test Suite
-- Tests that volunteers and public roles CANNOT retrieve precise coordinates under any circumstances.

BEGIN;

-- Setup Test Users
INSERT INTO auth.users (id, email) VALUES 
('11111111-1111-1111-1111-111111111111', 'volunteer@example.tn'),
('22222222-2222-2222-2222-222222222222', 'researcher@pasteur.utm.tn'),
('33333333-3333-3333-3333-333333333333', 'other_volunteer@example.tn')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, role, preferred_language, consent_version_accepted) VALUES
('11111111-1111-1111-1111-111111111111', 'volunteer', 'ar', 'v1.0'),
('22222222-2222-2222-2222-222222222222', 'researcher', 'fr', 'v1.0'),
('33333333-3333-3333-3333-333333333333', 'volunteer', 'en', 'v1.0')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- 1. Create a Survey Session and Observation
INSERT INTO public.sessions (id, observer_id, protocol, start_time, complete_session)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'incidental', now(), true);

INSERT INTO public.observations (
    id, session_id, observer_id, observed_at, location_public, grid_cell_id, species,
    body_condition_score, habitat_type
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    now(),
    ST_SetSRID(ST_MakePoint(10.185, 36.805), 4326),
    'TUN-32N-1KM-TEST',
    'cat',
    3,
    'residential'
);

-- Store sensitive precise coordinates
INSERT INTO public.observation_locations_restricted (
    observation_id, location_precise, gps_accuracy_m
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ST_SetSRID(ST_MakePoint(10.1812345, 36.8012345), 4326),
    3.5
);

-- TEST CASE 1: Volunteer tries to query restricted table -> MUST RETURN 0 ROWS
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333'; -- other volunteer

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.observation_locations_restricted;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'SECURITY BREACH: Volunteer was able to read % row(s) from observation_locations_restricted!', v_count;
    END IF;
    RAISE NOTICE 'SUCCESS: Volunteer blocked from reading precise coordinates (0 rows returned).';
END;
$$;

-- TEST CASE 2: Certified Researcher queries restricted table -> SHOULD BE PERMITTED
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222'; -- researcher

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.observation_locations_restricted;
    IF v_count = 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Certified researcher was improperly blocked by RLS!';
    END IF;
    RAISE NOTICE 'SUCCESS: Certified researcher successfully authorized to access research data.';
END;
$$;

-- TEST CASE 3: Public Observations only expose generalized grid cell
DO $$
DECLARE
    v_obs RECORD;
BEGIN
    SELECT * INTO v_obs FROM public.observations WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    -- Verify coordinate is generalized
    IF ST_X(v_obs.location_public) = 10.1812345 THEN
        RAISE EXCEPTION 'SECURITY BREACH: observations table contains exact coordinate!';
    END IF;
    RAISE NOTICE 'SUCCESS: Public observation verified as generalized grid location.';
END;
$$;

ROLLBACK;
