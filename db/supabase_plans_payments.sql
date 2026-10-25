-- ==============================================================================
-- NOORAYA: PLANS, PRICING AUDIT & FLUTTERWAVE PAYMENTS SCHEMA
-- Safe to run repeatedly (fully idempotent: CREATE IF NOT EXISTS, DROP IF EXISTS)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND PROFILES TABLE WITH SUBSCRIPTION & USER FIELDS
-- Safe even if public.profiles already existed from a Supabase starter template
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

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

-- ------------------------------------------------------------------------------
-- 2. PLANS TABLE (PRICING SOURCE OF TRUTH)
-- No amounts may be hardcoded in UI or backend; this table is the single authority.
-- ------------------------------------------------------------------------------
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

-- Seed ONE canonical row: premium_monthly at ₦500 for 30 days
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
  'الاشتراك الشهري',
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

-- ------------------------------------------------------------------------------
-- 3. PLAN PRICE CHANGE AUDIT LOG
-- Logs every price change: who changed it, old price, new price, and timestamp.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_price_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT NOT NULL,
  old_amount NUMERIC NOT NULL,
  new_amount NUMERIC NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_price_logs_code ON public.plan_price_logs (plan_code, changed_at DESC);

-- Trigger to automatically capture price changes on the plans table
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

-- ------------------------------------------------------------------------------
-- 4. PAYMENTS TABLE (FLUTTERWAVE TRANSACTIONS & VIRTUAL ACCOUNTS)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Plans RLS: Everyone (anon or authenticated) reads active plans; only admins change them.
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

-- Plan Price Logs RLS: Only admins or server can read or insert.
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

-- Payments RLS: Users read ONLY their own payments; admins read all; server writes.
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

-- ------------------------------------------------------------------------------
-- 6. SUPABASE REALTIME CONFIGURATION
-- Broadcasts changes to plans and payments instantly to all devices.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.plans REPLICA IDENTITY FULL;
  ALTER TABLE public.payments REPLICA IDENTITY FULL;

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
