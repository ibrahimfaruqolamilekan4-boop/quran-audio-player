// GET /api/backgrounds -> { backgrounds: BackgroundRow[] }
import { type Handler, q, sendJson } from './_lib.mjs';

export async function ensureBackgroundsTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS backgrounds (
      id               TEXT PRIMARY KEY,
      name_en          TEXT NOT NULL,
      name_ar          TEXT,
      category         TEXT NOT NULL,
      video_url        TEXT NOT NULL,
      video_url_720p   TEXT,
      video_url_480p   TEXT,
      poster_url       TEXT,
      size_bytes       BIGINT DEFAULT 0,
      duration_seconds NUMERIC DEFAULT 0,
      renditions       JSONB DEFAULT '[]'::jsonb,
      storage_paths    JSONB DEFAULT '[]'::jsonb,
      attribution      TEXT,
      sort_order       INT DEFAULT 0,
      is_active        BOOLEAN DEFAULT false,
      is_draft         BOOLEAN DEFAULT true,
      is_premium       BOOLEAN DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS video_url_720p TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS video_url_480p TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC DEFAULT 0`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS renditions JSONB DEFAULT '[]'::jsonb`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS storage_paths JSONB DEFAULT '[]'::jsonb`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS attribution TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false`).catch(() => {});

  await q(`
    CREATE INDEX IF NOT EXISTS idx_backgrounds_active_sort ON backgrounds (is_active, sort_order ASC, created_at DESC)
  `).catch(() => {});
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    await ensureBackgroundsTable().catch(() => {});

    const result = await q(`
      SELECT id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p, poster_url, size_bytes, duration_seconds, renditions, attribution, sort_order, is_active, is_draft, is_premium, created_at
      FROM backgrounds
      WHERE is_active = true
      ORDER BY sort_order ASC, created_at DESC
    `);

    // Stale-While-Revalidate headers for fast mobile loading without delay
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');

    return sendJson(res, 200, {
      backgrounds: result.rows || [],
    });
  } catch (err: any) {
    console.error('Failed to load backgrounds:', err);
    return sendJson(res, 500, { error: 'Failed to load backgrounds' });
  }
};

export default handler;
