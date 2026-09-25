-- Migration 000006: Row-Level Security (RLS) & Public Grants for Anonymous Users
-- Hawem (حايم) Citizen-Science Platform for Free-Roaming Fauna
--
-- Objective:
-- Enable unauthenticated visitors and new volunteers to view public density maps,
-- active survey routes, and community colonies without encountering 42501 permission denied,
-- while strictly preserving researcher-only access to precise GPS coordinates.

-- ==============================================================================
-- 1. SCHEMA & TABLE PRIVILEGES FOR ANON & AUTHENTICATED ROLES
-- ==============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Publicly readable catalogue tables
GRANT SELECT ON public.routes TO anon, authenticated;
GRANT SELECT ON public.observations TO anon, authenticated;
GRANT SELECT ON public.photos TO anon, authenticated;

-- Optional/v2 schema tables (if existing)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'colonies') THEN
        GRANT SELECT ON public.colonies TO anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'individuals') THEN
        GRANT SELECT ON public.individuals TO anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'badge_definitions') THEN
        GRANT SELECT ON public.badge_definitions TO anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quests') THEN
        GRANT SELECT ON public.quests TO anon, authenticated;
    END IF;
END $$;

-- RPC functions
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'get_public_density_map'
    ) THEN
        GRANT EXECUTE ON FUNCTION public.get_public_density_map TO anon, authenticated;
    END IF;
END $$;

-- ==============================================================================
-- 2. ROW-LEVEL SECURITY POLICIES: PUBLIC ACCESS
-- ==============================================================================

-- A. ROUTES: Anyone (anon or authenticated) can view active fixed routes
DROP POLICY IF EXISTS "All authenticated users can read fixed routes" ON public.routes;
DROP POLICY IF EXISTS "Routes readable by authenticated" ON public.routes;
DROP POLICY IF EXISTS "Allow public read on routes" ON public.routes;

CREATE POLICY "Allow public read on routes"
ON public.routes
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- B. OBSERVATIONS (1 km generalized public location):
-- Anyone can view aggregated, blurred observation points for public education and map rendering
DROP POLICY IF EXISTS "Anyone authenticated can view generalized observations" ON public.observations;
DROP POLICY IF EXISTS "All authenticated read observations" ON public.observations;
DROP POLICY IF EXISTS "Allow public read on generalized observations" ON public.observations;

CREATE POLICY "Allow public read on generalized observations"
ON public.observations
FOR SELECT
TO anon, authenticated
USING (true);

-- C. PHOTOS:
-- Public can view photos attached to observations
DROP POLICY IF EXISTS "All authenticated read photos" ON public.photos;
DROP POLICY IF EXISTS "Allow public read on photos" ON public.photos;

CREATE POLICY "Allow public read on photos"
ON public.photos
FOR SELECT
TO anon, authenticated
USING (true);

-- D. COLONIES & INDIVIDUALS (v2 tables if present)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'colonies') THEN
        DROP POLICY IF EXISTS "Colonies readable by authenticated" ON public.colonies;
        DROP POLICY IF EXISTS "Allow public read on colonies" ON public.colonies;
        CREATE POLICY "Allow public read on colonies"
        ON public.colonies FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'individuals') THEN
        DROP POLICY IF EXISTS "Individuals readable by authenticated" ON public.individuals;
        DROP POLICY IF EXISTS "Allow public read on individuals" ON public.individuals;
        CREATE POLICY "Allow public read on individuals"
        ON public.individuals FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
END $$;

-- ==============================================================================
-- 3. CRITICAL INVARIANT: PRECISE GPS COORDINATES REMAIN STRICTLY LOCKED
-- ==============================================================================
-- EXACT GPS COORDINATES MUST NEVER BE ACCESSIBLE TO ANON OR VOLUNTEERS
-- The policy on public.observation_locations_restricted remains strictly:
-- FOR SELECT TO authenticated USING (public.is_researcher_or_admin());
-- Verification check:
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'observation_locations_restricted'
    ) THEN
        -- Revoke any unintended privileges from anon
        REVOKE ALL ON public.observation_locations_restricted FROM anon;
    END IF;
END $$;
