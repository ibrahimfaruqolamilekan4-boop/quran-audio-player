// GET /api/backgrounds -> { backgrounds: BackgroundRow[], version: number, updated_at: string }
import { type Handler, q, sendJson, APPROVED_NASA_BACKGROUNDS } from './_lib.mjs';
import { getSupabaseAdmin } from './lib/supabase-server';

let seededNasaOnce = false;

export async function ensureBackgroundsTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS backgrounds (
      id                   TEXT PRIMARY KEY,
      name_en              TEXT NOT NULL,
      name_ar              TEXT,
      category             TEXT NOT NULL,
      video_url            TEXT NOT NULL,
      video_url_720p       TEXT,
      video_url_480p       TEXT,
      poster_url           TEXT,
      size_bytes           BIGINT DEFAULT 0,
      duration_seconds     NUMERIC DEFAULT 0,
      renditions           JSONB DEFAULT '[]'::jsonb,
      storage_paths        JSONB DEFAULT '[]'::jsonb,
      attribution          TEXT,
      source_url           TEXT,
      creator              TEXT,
      license_name         TEXT,
      license_url          TEXT,
      date_checked         TEXT,
      attribution_required BOOLEAN DEFAULT false,
      sort_order           INT DEFAULT 0,
      is_active            BOOLEAN DEFAULT true,
      is_draft             BOOLEAN DEFAULT false,
      is_premium           BOOLEAN DEFAULT false,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS video_url_720p TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS video_url_480p TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC DEFAULT 0`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS renditions JSONB DEFAULT '[]'::jsonb`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS storage_paths JSONB DEFAULT '[]'::jsonb`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS attribution TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS source_url TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS creator TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS license_name TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS license_url TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS date_checked TEXT`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS attribution_required BOOLEAN DEFAULT false`).catch(() => {});
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false`).catch(() => {});
  await q(`ALTER TABLE backgrounds ALTER COLUMN is_active SET DEFAULT true`).catch(() => {});
  await q(`ALTER TABLE backgrounds ALTER COLUMN is_draft SET DEFAULT false`).catch(() => {});

  await q(`
    CREATE TABLE IF NOT EXISTS backgrounds_meta (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      version BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await q(`
    INSERT INTO backgrounds_meta (id, version, updated_at)
    VALUES (1, 1, now())
    ON CONFLICT (id) DO NOTHING
  `).catch(() => {});

  await q(`
    CREATE INDEX IF NOT EXISTS idx_backgrounds_active_sort ON backgrounds (is_active, sort_order ASC, created_at DESC)
  `).catch(() => {});

  if (!seededNasaOnce) {
    seededNasaOnce = true;
    for (const nb of APPROVED_NASA_BACKGROUNDS) {
      await q(
        `INSERT INTO backgrounds (
           id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
           poster_url, size_bytes, duration_seconds, renditions, storage_paths,
           attribution, sort_order, is_active, is_draft, is_premium,
           source_url, creator, license_name, license_url, date_checked, attribution_required,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, now())
         ON CONFLICT (id) DO NOTHING`,
        [
          nb.id, nb.name_en, nb.name_ar, nb.category, nb.video_url, nb.video_url_720p, nb.video_url_480p,
          nb.poster_url, nb.size_bytes, nb.duration_seconds, JSON.stringify(nb.renditions || []), JSON.stringify(nb.storage_paths || []),
          nb.attribution, nb.sort_order, nb.is_active, nb.is_draft, nb.is_premium,
          nb.source_url, nb.creator, nb.license_name, nb.license_url, nb.date_checked, nb.attribution_required,
        ]
      ).catch(() => {});
    }
  }
}

export async function bumpBackgroundsVersion(): Promise<number> {
  let nextVersion = Date.now();
  try {
    const res = await q<{ version: number }>(
      `UPDATE backgrounds_meta SET version = version + 1, updated_at = now() WHERE id = 1 RETURNING version`
    );
    if (res.rows?.[0]?.version) {
      nextVersion = Number(res.rows[0].version);
    }
  } catch {}

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data: curr } = await sb.from('backgrounds_meta').select('version').eq('id', 1).maybeSingle();
      const v = Number(curr?.version || 1) + 1;
      nextVersion = Math.max(nextVersion, v);
      await sb.from('backgrounds_meta').upsert(
        { id: 1, version: v, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    } catch {}
  }

  return nextVersion;
}

export async function getActiveBackgroundsAndVersion(): Promise<{
  backgrounds: any[];
  version: number;
  updated_at: string;
}> {
  await ensureBackgroundsTable().catch(() => {});

  const byId = new Map<string, any>();
  let hiddenIds = new Set<string>();

  // 1. Check Supabase primary table if configured
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('backgrounds')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (row.is_active === false) {
            hiddenIds.add(row.id);
          } else {
            byId.set(row.id, row);
          }
        }
      }
    } catch (e) {
      console.warn('Supabase active backgrounds query fallback:', e);
    }
  }

  // 2. Also query Postgres / persistent serverStore
  try {
    const result = await q(`
      SELECT id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p, poster_url,
             size_bytes, duration_seconds, renditions, attribution, source_url, creator,
             license_name, license_url, date_checked, attribution_required,
             sort_order, is_active, is_draft, is_premium, created_at
      FROM backgrounds
      ORDER BY sort_order ASC, created_at DESC
    `);
    for (const row of result.rows || []) {
      if (row.is_active === false) {
        hiddenIds.add(row.id);
        byId.delete(row.id);
      } else if (!hiddenIds.has(row.id) && !byId.has(row.id)) {
        byId.set(row.id, row);
      }
    }
  } catch (e) {
    console.warn('Local/Postgres active backgrounds query notice:', e);
  }

  const backgrounds = Array.from(byId.values()).sort((a, b) => {
    const sa = Number(a.sort_order ?? 0);
    const sbOrder = Number(b.sort_order ?? 0);
    if (sa !== sbOrder) return sa - sbOrder;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

  // 3. Get list version counter
  let version = 1;
  let updated_at = new Date().toISOString();
  try {
    const metaRes = await q<{ version: number; updated_at: string }>(
      `SELECT version, updated_at FROM backgrounds_meta WHERE id = 1`
    );
    if (metaRes.rows?.[0]) {
      version = Number(metaRes.rows[0].version || 1);
      updated_at = metaRes.rows[0].updated_at || updated_at;
    }
  } catch {}

  if (sb) {
    try {
      const { data: meta } = await sb.from('backgrounds_meta').select('version, updated_at').eq('id', 1).maybeSingle();
      if (meta?.version && Number(meta.version) > version) {
        version = Number(meta.version);
        updated_at = meta.updated_at || updated_at;
      }
    } catch {}
  }

  return { backgrounds, version, updated_at };
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    // Never cache the list at the CDN edge so phones & admin verification always get real-time truth
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { backgrounds, version, updated_at } = await getActiveBackgroundsAndVersion();

    const urlObj = new URL(req.url || '/api/backgrounds', 'http://localhost');
    if (urlObj.searchParams.get('version_only') === '1') {
      return sendJson(res, 200, {
        version,
        count: backgrounds.length,
        updated_at,
      });
    }

    return sendJson(res, 200, {
      backgrounds,
      version,
      updated_at,
    });
  } catch (err: any) {
    console.error('Failed to load backgrounds:', err);
    return sendJson(res, 500, { error: 'Failed to load backgrounds' });
  }
};

export default handler;
