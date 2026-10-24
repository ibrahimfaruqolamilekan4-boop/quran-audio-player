-- ==============================================================================
-- SUPABASE SCHEMA: Ambient Backgrounds & Storage Configuration
-- ==============================================================================

-- 1. Create table 'backgrounds'
CREATE TABLE IF NOT EXISTS public.backgrounds (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  category TEXT NOT NULL, -- 'fireplace', 'rain', 'ocean', 'forest', 'night', 'cosmos', etc.
  video_url TEXT NOT NULL,
  poster_url TEXT,
  size_bytes BIGINT DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast category lookups and ordering
CREATE INDEX IF NOT EXISTS idx_backgrounds_active_sort ON public.backgrounds (is_active, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backgrounds_category ON public.backgrounds (category);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for public.backgrounds
-- Public read access: Anyone (anonymous and authenticated) can view active backgrounds
DROP POLICY IF EXISTS "Public can view active backgrounds" ON public.backgrounds;
DROP POLICY IF EXISTS "Admin full access to backgrounds" ON public.backgrounds;
DROP POLICY IF EXISTS "Only admin can insert backgrounds" ON public.backgrounds;
DROP POLICY IF EXISTS "Only admin can update backgrounds" ON public.backgrounds;
DROP POLICY IF EXISTS "Only admin can delete backgrounds" ON public.backgrounds;

-- SELECT: Public can view active backgrounds; admins can view all (active and inactive)
CREATE POLICY "Public can view active backgrounds"
  ON public.backgrounds
  FOR SELECT
  USING (
    is_active = true OR
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  );

-- INSERT: Only authenticated admin or service_role can insert rows
CREATE POLICY "Only admin can insert backgrounds"
  ON public.backgrounds
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  );

-- UPDATE: Only authenticated admin or service_role can update rows
CREATE POLICY "Only admin can update backgrounds"
  ON public.backgrounds
  FOR UPDATE
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  );

-- DELETE: Only authenticated admin or service_role can delete rows
CREATE POLICY "Only admin can delete backgrounds"
  ON public.backgrounds
  FOR DELETE
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  );

-- 4. Storage Bucket Setup: 'ambient-backgrounds'
-- Create public storage bucket if storage schema exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ambient-backgrounds',
  'ambient-backgrounds',
  true,
  47185920, -- 45 MB limit
  ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 47185920,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS: Public read access for ambient-backgrounds objects
DROP POLICY IF EXISTS "Public can read ambient-backgrounds bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can read ambient-backgrounds objects" ON storage.objects;
CREATE POLICY "Public can read ambient-backgrounds objects"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'ambient-backgrounds');

-- Storage RLS: Admin upload access for ambient-backgrounds bucket
DROP POLICY IF EXISTS "Admins can upload to ambient-backgrounds bucket" ON storage.objects;
CREATE POLICY "Admins can upload to ambient-backgrounds bucket"
  ON storage.objects
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR
      (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
      (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    )
  );

-- Storage RLS: Admin update access for ambient-backgrounds bucket
DROP POLICY IF EXISTS "Admins can update ambient-backgrounds bucket" ON storage.objects;
CREATE POLICY "Admins can update ambient-backgrounds bucket"
  ON storage.objects
  FOR UPDATE
  TO authenticated, service_role
  USING (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR
      (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
      (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR
      (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
      (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    )
  );

-- Storage RLS: Admin delete access for ambient-backgrounds bucket
DROP POLICY IF EXISTS "Admins can delete ambient-backgrounds bucket" ON storage.objects;
CREATE POLICY "Admins can delete ambient-backgrounds bucket"
  ON storage.objects
  FOR DELETE
  TO authenticated, service_role
  USING (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR
      (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
      (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    )
  );
