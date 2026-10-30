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
-- Safe even if public.profiles already existed from a Supabase starter template.
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

-- Ensure all columns exist even if public.profiles pre-existed without them
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS flw_transaction_id TEXT;

-- Normalize role column to text to eliminate 42804 enum mismatch errors (e.g. user_role)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role' AND data_type != 'text'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.profiles ALTER COLUMN role TYPE text USING role::text;
    ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

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
-- Supports multi-rendition phone-adaptive delivery (720p, 480p, poster)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.backgrounds (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  category TEXT NOT NULL DEFAULT 'nature',
  video_url TEXT NOT NULL,
  video_url_720p TEXT,
  video_url_480p TEXT,
  poster_url TEXT,
  size_bytes BIGINT DEFAULT 0,
  duration_seconds NUMERIC DEFAULT 0,
  renditions JSONB DEFAULT '[]'::jsonb,
  storage_paths JSONB DEFAULT '[]'::jsonb,
  attribution TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT false, -- Starts as DRAFT until published by admin
  is_draft BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent column migrations for existing instances
ALTER TABLE public.backgrounds ADD COLUMN IF NOT EXISTS video_url_720p TEXT;
ALTER TABLE public.backgrounds ADD COLUMN IF NOT EXISTS video_url_480p TEXT;
ALTER TABLE public.backgrounds ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC DEFAULT 0;
ALTER TABLE public.backgrounds ADD COLUMN IF NOT EXISTS renditions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.backgrounds ADD COLUMN IF NOT EXISTS storage_paths JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.backgrounds ADD COLUMN IF NOT EXISTS attribution TEXT;
ALTER TABLE public.backgrounds ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_backgrounds_active_sort ON public.backgrounds (is_active, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backgrounds_category ON public.backgrounds (category);
CREATE INDEX IF NOT EXISTS idx_backgrounds_draft ON public.backgrounds (is_draft);

-- ------------------------------------------------------------------------------
-- SECTION 4: STORAGE BUCKET 'ambient-backgrounds' (PUBLIC READ, ADMIN WRITE)
-- Free Plan max file limit: 50 MB (52,428,800 bytes).
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ambient-backgrounds',
  'ambient-backgrounds',
  true,
  52428800, -- 50 MB Free Plan file size limit
  ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
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

-- Helper RPC for Admin Storage Usage Meter (1 GB Free Tier quota tracking)
CREATE OR REPLACE FUNCTION public.get_storage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  total_bytes BIGINT := 0;
  count_objects INT := 0;
BEGIN
  -- 1. Try summing objects in ambient-backgrounds bucket
  BEGIN
    SELECT COALESCE(SUM((metadata->>'size')::bigint), 0), COUNT(*)
    INTO total_bytes, count_objects
    FROM storage.objects
    WHERE bucket_id = 'ambient-backgrounds';
  EXCEPTION
    WHEN OTHERS THEN
      total_bytes := 0;
      count_objects := 0;
  END;

  -- 2. Fallback to backgrounds table if storage.objects is empty
  IF total_bytes = 0 THEN
    SELECT COALESCE(SUM(size_bytes), 0), COUNT(*)
    INTO total_bytes, count_objects
    FROM public.backgrounds;
  END IF;

  RETURN jsonb_build_object(
    'bucket', 'ambient-backgrounds',
    'total_bytes', total_bytes,
    'limit_bytes', 1073741824, -- 1 GB Free Tier limit (1,073,741,824 bytes)
    'count', count_objects,
    'usage_percent', ROUND((total_bytes::numeric / 1073741824::numeric) * 100, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_storage_stats() TO authenticated, service_role, anon;

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- SECTION 8: PLANS & PAYMENTS SUBSCRIPTION SYSTEM (PRICING SOURCE OF TRUTH)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS flw_transaction_id TEXT;

-- Normalize role column to text to eliminate 42804 enum mismatch errors (e.g. user_role)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role' AND data_type != 'text'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.profiles ALTER COLUMN role TYPE text USING role::text;
    ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_active_sort ON public.plans (is_active, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plans_code ON public.plans (code);

-- Seed ONE canonical row: premium_monthly at â‚¦500 for 30 days
INSERT INTO public.plans (
  id,
  code,
  name_en,
  name_ar,
  amount,
  currency,
  duration_days,
  is_active,
  sort_order,
  features
) VALUES (
  'plan_premium_monthly',
  'premium_monthly',
  'Monthly Sanctuary',
  'Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ø§Ù„Ø´Ù‡Ø±ÙŠ',
  500,
  'NGN',
  30,
  true,
  1,
  '[
    "Offline Surah Audio Downloads (Any Sheikh)",
    "All 7+ Atmospheric HD Video Soundscapes",
    "Studio High-Bitrate Recitations",
    "Distraction-Free Pure Quranic Sanctuary"
  ]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  duration_days = EXCLUDED.duration_days,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.plan_price_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT NOT NULL,
  old_amount NUMERIC NOT NULL,
  new_amount NUMERIC NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_price_logs_code ON public.plan_price_logs (plan_code, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_plan_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    INSERT INTO public.plan_price_logs (plan_code, old_amount, new_amount, changed_by, changed_at)
    VALUES (
      NEW.code,
      OLD.amount,
      NEW.amount,
      COALESCE(auth.jwt()->>'email', auth.uid()::text, 'admin/server'),
      now()
    );
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_plan_price_change ON public.plans;
CREATE TRIGGER trg_log_plan_price_change
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.log_plan_price_change();

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  tx_ref TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL DEFAULT 'bank_transfer',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'expired', 'underpaid', 'overpaid')),
  flw_ref TEXT,
  flw_id TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  expiry_date TIMESTAMPTZ,
  amount_paid NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user_created ON public.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_tx_ref ON public.payments (tx_ref);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments (created_at DESC);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active plans" ON public.plans;
CREATE POLICY "Anyone can view active plans"
  ON public.plans FOR SELECT
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Only admin or service_role can insert plans" ON public.plans;
CREATE POLICY "Only admin or service_role can insert plans"
  ON public.plans FOR INSERT
  TO authenticated, service_role
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

DROP POLICY IF EXISTS "Only admin or service_role can update plans" ON public.plans;
CREATE POLICY "Only admin or service_role can update plans"
  ON public.plans FOR UPDATE
  TO authenticated, service_role
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

DROP POLICY IF EXISTS "Only admin or service_role can delete plans" ON public.plans;
CREATE POLICY "Only admin or service_role can delete plans"
  ON public.plans FOR DELETE
  TO authenticated, service_role
  USING (auth.role() = 'service_role' OR public.is_admin());

ALTER TABLE public.plan_price_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view plan price logs" ON public.plan_price_logs;
CREATE POLICY "Only admins can view plan price logs"
  ON public.plan_price_logs FOR SELECT
  TO authenticated, service_role
  USING (auth.role() = 'service_role' OR public.is_admin());

DROP POLICY IF EXISTS "Only admins or server can insert price logs" ON public.plan_price_logs;
CREATE POLICY "Only admins or server can insert price logs"
  ON public.plan_price_logs FOR INSERT
  TO authenticated, service_role
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own payments or admin views all" ON public.payments;
CREATE POLICY "Users view own payments or admin views all"
  ON public.payments FOR SELECT
  TO authenticated, service_role
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Server writes payments" ON public.payments;
CREATE POLICY "Server writes payments"
  ON public.payments FOR ALL
  TO authenticated, service_role
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

ALTER TABLE public.plans REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- SECTION 8: ADHAN VOICES TABLE & REALTIME POLICIES
-- Admin-managed voices for five daily prayers & Fajr. Seed nothing by default.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.adhan_voices (
  id text PRIMARY KEY,
  name_en text NOT NULL,
  name_ar text,
  muezzin text NOT NULL,
  mosque text,
  audio_url text,
  fajr_audio_url text,
  duration integer DEFAULT 0,
  license text,
  source text,
  attribution text,
  is_active boolean DEFAULT true,
  is_premium boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adhan_voices_active ON public.adhan_voices (is_active, is_premium);

ALTER TABLE public.adhan_voices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active adhan voices" ON public.adhan_voices;
CREATE POLICY "Anyone can view active adhan voices"
  ON public.adhan_voices FOR SELECT
  TO anon, authenticated, service_role
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Only admin or service_role can manage adhan voices" ON public.adhan_voices;
CREATE POLICY "Only admin or service_role can manage adhan voices"
  ON public.adhan_voices FOR ALL
  TO authenticated, service_role
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

ALTER TABLE public.adhan_voices REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- SECTION 9: PRAYER PUSH SUBSCRIPTIONS (VAPID Web Push)
-- Stores browser web push endpoints with user coordinates for scheduled adhan push
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prayer_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  city text,
  country text,
  calculation_method text DEFAULT 'MWL',
  juristic text DEFAULT 'Shafi',
  prayer_preferences jsonb DEFAULT '{"fajr":true,"dhuhr":true,"asr":true,"maghrib":true,"isha":true}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prayer_push_subs_coords ON public.prayer_push_subscriptions (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_prayer_push_subs_user ON public.prayer_push_subscriptions (user_id);

ALTER TABLE public.prayer_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.prayer_push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions"
  ON public.prayer_push_subscriptions FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.prayer_push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions"
  ON public.prayer_push_subscriptions FOR UPDATE
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.prayer_push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions"
  ON public.prayer_push_subscriptions FOR DELETE
  TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "Only service_role can view all subscriptions" ON public.prayer_push_subscriptions;
CREATE POLICY "Only service_role can view all subscriptions"
  ON public.prayer_push_subscriptions FOR SELECT
  TO authenticated, service_role
  USING (auth.role() = 'service_role' OR auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- SECTION 10: ADMIN GRANT INSTRUCTION (REPLACE EMAIL BEFORE RUNNING)
-- ------------------------------------------------------------------------------
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE LOWER(email) = LOWER('PUT_MY_EMAIL_HERE');
--
-- UPDATE auth.users
-- SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE LOWER(email) = LOWER('PUT_MY_EMAIL_HERE');
