-- ==============================================================================
-- SUPABASE / POSTGRES SCHEMA: Ambient Backgrounds & Storage Configuration
-- ==============================================================================

-- 1. Create table 'backgrounds' (compatible with Supabase and Neon Postgres)
CREATE TABLE IF NOT EXISTS backgrounds (
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
CREATE INDEX IF NOT EXISTS idx_backgrounds_active_sort ON backgrounds (is_active, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backgrounds_category ON backgrounds (category);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE backgrounds ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Public can view active backgrounds" ON backgrounds;
DROP POLICY IF EXISTS "Only admin can insert backgrounds" ON backgrounds;
DROP POLICY IF EXISTS "Only admin can update backgrounds" ON backgrounds;
DROP POLICY IF EXISTS "Only admin can delete backgrounds" ON backgrounds;

-- SELECT: Public can view active backgrounds; admins can view all
CREATE POLICY "Public can view active backgrounds"
  ON backgrounds
  FOR SELECT
  USING (
    is_active = true OR
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  );

-- INSERT: Only authenticated admin or service_role can insert rows
CREATE POLICY "Only admin can insert backgrounds"
  ON backgrounds
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  );

-- UPDATE: Only authenticated admin or service_role can update rows
CREATE POLICY "Only admin can update backgrounds"
  ON backgrounds
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
  ON backgrounds
  FOR DELETE
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  );
