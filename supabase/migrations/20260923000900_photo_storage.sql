-- Storage for animal photographs.
--
-- Photographs are the raw material for individual re-identification, and they
-- are also the most location-revealing thing the app handles: a street corner
-- is recognisable in a way a coordinate is not. So the bucket is private, and
-- object paths carry no coordinates, no timestamps beyond the observation id,
-- and no clue about who took them beyond the owner's own prefix.
--
-- Path layout:  <user_id>/<observation_id>/<photo_id>.jpg
--
-- The first segment is the only thing the policies need to compare, and it
-- also gives account deletion a single prefix to remove.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'animal-photos',
  'animal-photos',
  false,
  -- 8 MB. Photos are compressed on device but must stay large enough for
  -- pattern matching (longest side >= 1600 px).
  8388608,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies. storage.objects has RLS enabled by Supabase already.
-- ---------------------------------------------------------------------------

-- A user may upload only beneath their own prefix. Without the prefix check a
-- volunteer could write into someone else's folder, or overwrite their photos.
create policy "animal photos: insert own prefix"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'animal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reading is own-photos-only, plus researchers, who need them for photo-ID.
create policy "animal photos: read own or researcher"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'animal-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_read_precise_locations()
    )
  );

-- A retried upload must be able to replace a half-written object, but only
-- within the uploader's own prefix.
create policy "animal photos: update own prefix"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'animal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'animal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Account deletion has to be able to remove the files as well as the rows.
create policy "animal photos: delete own prefix"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'animal-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- anon gets nothing at all: no listing, no reading, no signed-URL minting.
revoke all on storage.objects from anon;

-- Note, since storage.objects belongs to the Storage service and cannot carry
-- our own COMMENT: objects live under <user_id>/<observation_id>/<photo_id>.jpg
-- so the policies above can compare the first path segment. Never make this
-- bucket public -- a photograph shows a recognisable place, which is exactly
-- what the rest of this schema withholds.
