-- Migration 000002: Row-Level Security (RLS) & Ethical Location Protection
-- Citizen-Science App for Free-Roaming Cats & Dogs (Tunisia)

-- 1. Helper Security Functions (SECURITY DEFINER to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.users
    WHERE id = auth.uid();
    
    RETURN COALESCE(v_role, 'volunteer'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_researcher_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.current_user_role() IN ('researcher', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Enable RLS on All Tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_locations_restricted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_audit_log ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. CRITICAL ETHICAL POLICIES: observation_locations_restricted
-- EXACT GPS COORDINATES MUST NEVER BE ACCESSIBLE TO VOLUNTEERS OR THE PUBLIC
-- ==============================================================================

-- SELECT: Only Certified Researchers and Administrators
CREATE POLICY "Strict researcher select on precise locations"
ON public.observation_locations_restricted
FOR SELECT
TO authenticated
USING (public.is_researcher_or_admin());

-- INSERT: Observers can insert precise locations strictly for their own observation
CREATE POLICY "Observers can insert precise location for own observation"
ON public.observation_locations_restricted
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.observations
        WHERE observations.id = observation_id
        AND observations.observer_id = auth.uid()
    )
);

-- UPDATE/DELETE: Restricted to Admins
CREATE POLICY "Admin only modify precise locations"
ON public.observation_locations_restricted
FOR UPDATE
TO authenticated
USING (public.current_user_role() = 'admin');

CREATE POLICY "Admin only delete precise locations"
ON public.observation_locations_restricted
FOR DELETE
TO authenticated
USING (public.current_user_role() = 'admin');

-- ==============================================================================
-- 4. POLICIES: observations (Generalized 1km location)
-- ==============================================================================

CREATE POLICY "Anyone authenticated can view generalized observations"
ON public.observations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Observers can insert their own observations"
ON public.observations
FOR INSERT
TO authenticated
WITH CHECK (observer_id = auth.uid());

CREATE POLICY "Observers can update their own observations"
ON public.observations
FOR UPDATE
TO authenticated
USING (observer_id = auth.uid() OR public.is_researcher_or_admin());

-- ==============================================================================
-- 5. POLICIES: sessions
-- ==============================================================================

CREATE POLICY "Users can view own sessions or researchers view all"
ON public.sessions
FOR SELECT
TO authenticated
USING (observer_id = auth.uid() OR public.is_researcher_or_admin());

CREATE POLICY "Users can insert own sessions"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (observer_id = auth.uid());

CREATE POLICY "Users can update own active sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (observer_id = auth.uid());

-- ==============================================================================
-- 6. POLICIES: routes (Fixed transects)
-- ==============================================================================

CREATE POLICY "All authenticated users can read fixed routes"
ON public.routes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only researchers and admins can manage fixed routes"
ON public.routes
FOR ALL
TO authenticated
USING (public.is_researcher_or_admin())
WITH CHECK (public.is_researcher_or_admin());

-- ==============================================================================
-- 7. POLICIES: users
-- ==============================================================================

CREATE POLICY "Users can read own profile or researchers/admins read all"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_researcher_or_admin());

CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- ==============================================================================
-- 8. POLICIES: export_audit_log
-- ==============================================================================

CREATE POLICY "Researchers can insert export logs"
ON public.export_audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_researcher_or_admin());

CREATE POLICY "Admins can view export audit logs"
ON public.export_audit_log
FOR SELECT
TO authenticated
USING (public.current_user_role() = 'admin');
