-- Nooraya / Quran Audio Player — Neon (Postgres) schema
-- Mirrors the old Firestore structure:
--   users/{uid}                      -> public.users
--   users/{uid}/preferences/default  -> public.user_preferences
--   users/{uid}/customReciters/{id}  -> public.custom_reciters
--   global_reciters/{id}             -> public.global_reciters
--   ambient_sounds/{id}              -> public.ambient_sounds

CREATE TABLE IF NOT EXISTS users (
  uid           TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                       -- NULL for accounts migrated from Firebase (they set a password on first login)
  display_name  TEXT,
  photo_url     TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_uid                   TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  theme                      TEXT NOT NULL DEFAULT 'midnight-scholar',
  active_background_video_id TEXT,
  ambient_video_mapping      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_reciters (
  id         TEXT PRIMARY KEY,
  user_uid   TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  style      TEXT,
  server_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_reciters_user ON custom_reciters(user_uid);

CREATE TABLE IF NOT EXISTS global_reciters (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  style      TEXT,
  server_url TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ambient_sounds (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  video_url  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
