// GET /api/backgrounds -> { backgrounds: BackgroundRow[] }
import { type Handler, q, sendJson } from './_lib.mjs';

export async function ensureBackgroundsTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS backgrounds (
      id          TEXT PRIMARY KEY,
      name_en     TEXT NOT NULL,
      name_ar     TEXT,
      category    TEXT NOT NULL,
      video_url   TEXT NOT NULL,
      poster_url  TEXT,
      size_bytes  BIGINT DEFAULT 0,
      sort_order  INT DEFAULT 0,
      is_active   BOOLEAN DEFAULT true,
      is_premium  BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

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
      SELECT id, name_en, name_ar, category, video_url, poster_url, size_bytes, sort_order, is_active, is_premium, created_at
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
