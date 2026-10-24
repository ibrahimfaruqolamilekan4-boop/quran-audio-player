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

-- Default system backgrounds (hosted on reliable fast CDN)
INSERT INTO backgrounds (id, name_en, name_ar, category, video_url, poster_url, sort_order, is_active, is_premium)
VALUES 
  ('bg_cosmos_01', 'Night Sky & Cosmos', 'آفاق الكون', 'cosmos', 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-the-night-sky-22920-large.mp4', 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1280&q=80', 1, true, false),
  ('bg_rain_01', 'Rain on Sanctuary Roof', 'دعاء المطر', 'rain', 'https://assets.mixkit.co/videos/preview/mixkit-rain-falling-on-the-water-of-a-lake-seen-up-close-18312-large.mp4', 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1280&q=80', 2, true, false),
  ('bg_ocean_01', 'Tranquil Ocean Waves', 'سكينة البحر', 'ocean', 'https://assets.mixkit.co/videos/preview/mixkit-sea-water-breaking-on-the-rocks-of-a-beach-at-sunset-41485-large.mp4', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&q=80', 3, true, false),
  ('bg_forest_01', 'Sacred Forest Breeze', 'ذكر الطبيعة', 'forest', 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4', 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1280&q=80', 4, true, false),
  ('bg_fireplace_01', 'Warm Fireplace Hearth', 'دفء الموقد', 'fireplace', 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-fire-burning-in-a-fireplace-43254-large.mp4', 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1280&q=80', 5, true, false)
ON CONFLICT (id) DO NOTHING;
