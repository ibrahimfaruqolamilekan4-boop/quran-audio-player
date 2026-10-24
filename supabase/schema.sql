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

-- 3. RLS Policies
-- Public read access: Anyone (anonymous and authenticated) can view active backgrounds
DROP POLICY IF EXISTS "Public can view active backgrounds" ON public.backgrounds;
CREATE POLICY "Public can view active backgrounds"
  ON public.backgrounds
  FOR SELECT
  USING (is_active = true);

-- Admin full access: Service role or admin users can insert, update, delete
DROP POLICY IF EXISTS "Admin full access to backgrounds" ON public.backgrounds;
CREATE POLICY "Admin full access to backgrounds"
  ON public.backgrounds
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    (auth.jwt() ->> 'email' IN (SELECT email FROM auth.users WHERE raw_user_meta_data ->> 'role' = 'admin')) OR
    (auth.jwt() ->> 'role' = 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.jwt() ->> 'email' IN (SELECT email FROM auth.users WHERE raw_user_meta_data ->> 'role' = 'admin')) OR
    (auth.jwt() ->> 'role' = 'admin')
  );

-- 4. Storage Bucket Setup: 'ambient-backgrounds'
-- Create public storage bucket if storage schema exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ambient-backgrounds',
  'ambient-backgrounds',
  true,
  52428800, -- 50 MB limit
  ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS: Public read access for ambient-backgrounds objects
DROP POLICY IF EXISTS "Public can read ambient-backgrounds bucket" ON storage.objects;
CREATE POLICY "Public can read ambient-backgrounds bucket"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'ambient-backgrounds');

-- Storage RLS: Admin upload/modify/delete access for ambient-backgrounds bucket
DROP POLICY IF EXISTS "Admins can upload to ambient-backgrounds bucket" ON storage.objects;
CREATE POLICY "Admins can upload to ambient-backgrounds bucket"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR
      (auth.jwt() ->> 'role' = 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR
      (auth.jwt() ->> 'role' = 'admin')
    )
  );
