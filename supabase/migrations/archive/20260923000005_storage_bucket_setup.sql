-- Migration 000005: Supabase Storage Bucket & Policies for Animal Field Photos
-- Hawem (حايم) Citizen-Science Platform for Free-Roaming Fauna

-- 1. Initialize public storage bucket for animal photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'animal-photos',
    'animal-photos',
    true,
    10485760, -- 10 MB per image limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage Objects RLS Policies
-- Allow public read access to animal photos for researchers, dashboard, and public app views
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access Animal Photos'
    ) THEN
        CREATE POLICY "Public Access Animal Photos"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'animal-photos');
    END IF;
END $$;

-- Allow authenticated surveyors and anonymous field workers to upload photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Surveyors Upload Animal Photos'
    ) THEN
        CREATE POLICY "Surveyors Upload Animal Photos"
        ON storage.objects FOR INSERT
        TO authenticated, anon
        WITH CHECK (bucket_id = 'animal-photos');
    END IF;
END $$;

-- Allow observers to update their uploaded photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Surveyors Update Own Animal Photos'
    ) THEN
        CREATE POLICY "Surveyors Update Own Animal Photos"
        ON storage.objects FOR UPDATE
        TO authenticated, anon
        USING (bucket_id = 'animal-photos');
    END IF;
END $$;

-- Allow researchers and administrators to manage/delete photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Researchers Delete Animal Photos'
    ) THEN
        CREATE POLICY "Researchers Delete Animal Photos"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'animal-photos' AND 
            (SELECT public.is_researcher_or_admin())
        );
    END IF;
END $$;
