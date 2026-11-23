-- ==============================================================================
-- NOORAYA PHASE 1: CLOSED-APP WEB PUSH SCHEDULER, DEDUPLICATION & PG_CRON
-- Safe to run repeatedly (idempotent). Contains ZERO hardcoded secrets.
-- ==============================================================================

-- 1. Extend push_subscriptions with per-prayer overrides & diagnostics columns
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS prayer_voices JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prayer_reminder_offsets JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prayer_volumes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prayer_vibrate JSONB NOT NULL DEFAULT '{"fajr":true,"sunrise":false,"dhuhr":true,"asr":true,"maghrib":true,"isha":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_24_hour BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_late_delivery_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active_failures
  ON public.push_subscriptions (is_active, failure_count);

-- 2. Race-proof Push Delivery Deduplication & Audit Log Table
CREATE TABLE IF NOT EXISTS public.push_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  fire_key TEXT NOT NULL,
  prayer_key TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'queued',
  http_status INT,
  attempts INT NOT NULL DEFAULT 1,
  error_message TEXT,
  CONSTRAINT uq_push_delivery_sub_fire_key UNIQUE (subscription_id, fire_key)
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_sent_at
  ON public.push_delivery_logs (sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_endpoint
  ON public.push_delivery_logs (endpoint, sent_at DESC);

ALTER TABLE public.push_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role or admin reads push_delivery_logs" ON public.push_delivery_logs;
CREATE POLICY "Service role or admin reads push_delivery_logs"
  ON public.push_delivery_logs FOR ALL
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- 3. Automatic 14-day retention cleanup helper for push_delivery_logs
CREATE OR REPLACE FUNCTION public.cleanup_old_push_delivery_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM public.push_delivery_logs
  WHERE sent_at < now() - INTERVAL '14 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4. Enable pg_cron & pg_net extensions (Supabase Free & Pro)
-- NOTE: Store secrets in Supabase Vault ONCE via SQL Editor (never commit secrets):
--   SELECT vault.create_secret('https://quran-audio-player-delta.vercel.app', 'nooraya_app_url');
--   SELECT vault.create_secret('<YOUR_CRON_SECRET>', 'nooraya_cron_secret');
--   (Or invoke the Supabase Edge Function `prayer-push-dispatch` at
--    https://<PROJECT_REF>.supabase.co/functions/v1/prayer-push-dispatch)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function executed every minute by pg_cron. Reads URL + CRON_SECRET from Vault
-- so no secret is ever stored in SQL migrations or cron.job command text.
CREATE OR REPLACE FUNCTION public.invoke_nooraya_push_dispatch()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault, pg_temp
AS $$
DECLARE
  v_app_url TEXT;
  v_cron_secret TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_app_url
  FROM vault.decrypted_secrets
  WHERE name = 'nooraya_app_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'nooraya_cron_secret'
  LIMIT 1;

  IF v_app_url IS NULL OR length(trim(v_app_url)) = 0 THEN
    RAISE NOTICE 'nooraya_app_url secret not set in Supabase Vault; skipping push dispatch.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(v_app_url, '/') || '/api/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_cron_secret, '')
    ),
    body := jsonb_build_object(
      'source', 'supabase_pg_cron',
      'triggeredAt', now()
    ),
    timeout_milliseconds := 15000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Unschedule any previous job with the same name, then register the live 1-minute schedule
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nooraya-prayer-push-every-minute') THEN
    PERFORM cron.unschedule('nooraya-prayer-push-every-minute');
  END IF;

  PERFORM cron.schedule(
    'nooraya-prayer-push-every-minute',
    '* * * * *',
    'SELECT public.invoke_nooraya_push_dispatch();'
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nooraya-push-logs-daily-cleanup') THEN
    PERFORM cron.unschedule('nooraya-push-logs-daily-cleanup');
  END IF;

  PERFORM cron.schedule(
    'nooraya-push-logs-daily-cleanup',
    '15 3 * * *',
    'SELECT public.cleanup_old_push_delivery_logs();'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron scheduling notice (enable pg_cron extension first): %', SQLERRM;
END;
$$;
