-- Foundation: extensions, controlled vocabularies, role helpers.
--
-- The vocabularies below mirror packages/shared/src/schema/vocabularies.ts.
-- Changing one without the other will silently reject valid client records,
-- so change both in the same commit.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Controlled vocabularies
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('volunteer', 'trained_surveyor', 'researcher', 'admin');
create type public.language as enum ('ar', 'fr', 'en');
create type public.protocol as enum ('transect', 'stationary_point', 'incidental');
create type public.species as enum ('cat', 'dog', 'unknown');
create type public.sex as enum ('male', 'female', 'unknown');
create type public.age_class as enum ('juvenile', 'adult', 'unknown');
create type public.reproductive_status as enum ('lactating', 'visibly_pregnant', 'none_visible', 'unknown');
create type public.health_issue as enum ('skin_lesions_mange', 'wound', 'limp', 'eye_nose_discharge', 'tumour', 'none');
create type public.tristate as enum ('yes', 'no', 'unknown');
create type public.behaviour as enum ('approachable', 'neutral', 'fearful', 'aggressive');
create type public.habitat_type as enum (
  'residential', 'commercial', 'market', 'landfill_garbage', 'slaughterhouse_vicinity',
  'agricultural', 'beach_coastal', 'natural_area', 'other'
);
create type public.food_source as enum ('garbage', 'deliberate_feeding', 'none', 'other');
create type public.coat_pattern as enum (
  'tabby', 'bicolour_piebald', 'tortoiseshell_calico', 'solid_black', 'solid_other', 'other'
);
-- Coat patterns are asymmetric: a left flank is never comparable to a right flank.
create type public.photo_angle as enum ('left_flank', 'right_flank', 'face', 'other');
create type public.weather as enum ('clear', 'cloudy', 'rain', 'wind');
create type public.time_of_day as enum ('dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night');
create type public.match_method as enum ('human', 'algorithm');
create type public.match_status as enum ('proposed', 'confirmed', 'rejected');
