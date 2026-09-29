-- Stand-ins for the Supabase platform pieces the migrations touch, so they can
-- be replayed on a plain PostGIS container (supabase/tests/run_sql_behaviour.sh).
-- Mirrors hosted Supabase: extensions live in the `extensions` schema, which is
-- on the search path, and PostGIS is not preinstalled.
DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE;
DROP EXTENSION IF EXISTS postgis_topology CASCADE;
DROP EXTENSION IF EXISTS fuzzystrmatch CASCADE;
DROP EXTENSION IF EXISTS postgis CASCADE;
DROP SCHEMA IF EXISTS tiger CASCADE;
DROP SCHEMA IF EXISTS tiger_data CASCADE;
DROP SCHEMA IF EXISTS topology CASCADE;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER DATABASE postgres SET search_path = "$user", public, extensions;
SET search_path = "$user", public, extensions;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID $$;
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY, name TEXT, public BOOLEAN, file_size_limit BIGINT, allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT, name TEXT, owner UUID, owner_id TEXT
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON storage.objects TO authenticated;

DO $$ BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
