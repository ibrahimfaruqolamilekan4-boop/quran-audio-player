-- ==============================================================================
-- NOORAYA: COMPLETE SUPABASE PRODUCTION SCHEMA & SECURITY CONFIGURATION
-- Safe to run repeatedly (fully idempotent: CREATE IF NOT EXISTS, DROP IF EXISTS)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: SECURITY DEFINER ADMIN HELPER FUNCTION
-- Determines admin status based on profiles table and JWT app_metadata.
-- Normal users CANNOT edit or forge this role.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- 1. Service role (backend cron, serverless functions) is always admin
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  -- 2. JWT app_metadata role = 'admin' (set strictly by server/dashboard, never client)
  IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN
    RETURN true;
  END IF;

  -- 3. JWT user_metadata fallback
  IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' THEN
    RETURN true;
  END IF;

  -- 4. Check profiles table for the currently authenticated user
  IF auth.uid() IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    );
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- SECTION 2: PROFILES TABLE & AUTH TRIGGER
-- Automatically mirrors auth.users into public.profiles with role & premium status.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_premium BOOLEAN NOT NULL DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast indexes for admin filtering & searches
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_premium ON public.profiles (is_premium);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles (created_at DESC);

-- Automatic user profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    is_premium,
    created_at,
    last_seen_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    ),
    COALESCE(
      NEW.raw_app_meta_data->>'role',
      'user'
    ),
    false,
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    last_seen_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth.users into public.profiles
INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_premium, created_at, last_seen_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  COALESCE(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture'
  ),
  COALESCE(u.raw_app_meta_data->>'role', 'user'),
  false,
  COALESCE(u.created_at, now()),
  COALESCE(u.last_sign_in_at, now())
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  last_seen_at = EXCLUDED.last_seen_at;

-- ------------------------------------------------------------------------------
-- SECTION 3: BACKGROUNDS TABLE (NO SEED ROWS - ADMIN UPLOADS LIVE VIDEOS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.backgrounds (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  category TEXT NOT NULL DEFAULT 'nature',
  video_url TEXT NOT NULL,
  poster_url TEXT,
  size_bytes BIGINT DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backgrounds_active_sort ON public.backgrounds (is_active, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backgrounds_category ON public.backgrounds (category);

-- ------------------------------------------------------------------------------
-- SECTION 4: STORAGE BUCKET 'ambient-backgrounds' (PUBLIC READ, ADMIN WRITE)
-- ------------------------------------------------------------------------------
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

-- Storage RLS Policies
DROP POLICY IF EXISTS "Public can read ambient-backgrounds objects" ON storage.objects;
CREATE POLICY "Public can read ambient-backgrounds objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ambient-backgrounds');

DROP POLICY IF EXISTS "Admins can upload to ambient-backgrounds bucket" ON storage.objects;
CREATE POLICY "Admins can upload to ambient-backgrounds bucket"
  ON storage.objects FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Admins can update ambient-backgrounds bucket" ON storage.objects;
CREATE POLICY "Admins can update ambient-backgrounds bucket"
  ON storage.objects FOR UPDATE
  TO authenticated, service_role
  USING (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR public.is_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Admins can delete ambient-backgrounds bucket" ON storage.objects;
CREATE POLICY "Admins can delete ambient-backgrounds bucket"
  ON storage.objects FOR DELETE
  TO authenticated, service_role
  USING (
    bucket_id = 'ambient-backgrounds' AND (
      auth.role() = 'service_role' OR public.is_admin()
    )
  );

-- ------------------------------------------------------------------------------
-- SECTION 5: ROW LEVEL SECURITY (RLS) FOR ALL TABLES
-- Least privilege: users read/update only their own profile, admins manage all.
-- Privileged columns (role, is_premium) are strictly guarded against tampering.
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile or admin reads all" ON public.profiles;
CREATE POLICY "Users can read own profile or admin reads all"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id OR public.is_admin()
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = id OR public.is_admin()
  );

-- Database trigger to strictly prevent non-admins from self-promoting or granting premium
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    -- Force protected fields back to old values
    NEW.role := OLD.role;
    NEW.is_premium := OLD.is_premium;
    NEW.premium_expires_at := OLD.premium_expires_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (
    auth.role() = 'service_role' OR public.is_admin()
  );

-- Backgrounds RLS
ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active backgrounds" ON public.backgrounds;
CREATE POLICY "Public can view active backgrounds"
  ON public.backgrounds FOR SELECT
  USING (
    is_active = true OR public.is_admin()
  );

DROP POLICY IF EXISTS "Only admin can insert backgrounds" ON public.backgrounds;
CREATE POLICY "Only admin can insert backgrounds"
  ON public.backgrounds FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    auth.role() = 'service_role' OR public.is_admin()
  );

DROP POLICY IF EXISTS "Only admin can update backgrounds" ON public.backgrounds;
CREATE POLICY "Only admin can update backgrounds"
  ON public.backgrounds FOR UPDATE
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR public.is_admin()
  )
  WITH CHECK (
    auth.role() = 'service_role' OR public.is_admin()
  );

DROP POLICY IF EXISTS "Only admin can delete backgrounds" ON public.backgrounds;
CREATE POLICY "Only admin can delete backgrounds"
  ON public.backgrounds FOR DELETE
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR public.is_admin()
  );

-- ------------------------------------------------------------------------------
-- SECTION 6: SUPABASE REALTIME CONFIGURATION
-- Enables instant multi-device push on backgrounds and profiles changes.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.backgrounds REPLICA IDENTITY FULL;
  ALTER TABLE public.profiles REPLICA IDENTITY FULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'backgrounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.backgrounds;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- SECTION 7: ADMIN GRANT INSTRUCTION (REPLACE EMAIL BEFORE RUNNING)
-- ------------------------------------------------------------------------------
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE LOWER(email) = LOWER('PUT_MY_EMAIL_HERE');
--
-- UPDATE auth.users
-- SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE LOWER(email) = LOWER('PUT_MY_EMAIL_HERE');
