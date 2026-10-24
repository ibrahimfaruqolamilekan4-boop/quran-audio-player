// GET /api/ambient -> { ambientSounds: Record<string, string>, videos: Array<{ id, name, videoUrl, description, isDefault }>, activeDefaultVideoUrl: string | null }
import { type Handler, q, sendJson } from './_lib.mjs';
import { ensureBackgroundsTable } from './backgrounds';

function normalizeStoredVideoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim().replace(/^https?:\/\/localhost(:\d+)?/, '');
  if (!url || url.startsWith('blob:')) return null;
  return url;
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    await ensureBackgroundsTable().catch(() => {});

    const ambient = await q<{ id: string; video_url: string | null }>(
      'SELECT id, video_url FROM ambient_sounds WHERE video_url IS NOT NULL'
    );
    const ambientSounds: Record<string, string> = {};
    let activeDefaultVideoUrl: string | null = null;

    for (const row of ambient.rows) {
      const validUrl = normalizeStoredVideoUrl(row.video_url);
      if (validUrl) {
        ambientSounds[row.id] = validUrl;
        if (row.id === 'default' || row.id === 'active' || row.id === 'global') {
          activeDefaultVideoUrl = validUrl;
        }
      }
    }

    const videos: Array<{ id: string; name: string; videoUrl: string; posterUrl?: string; description?: string; isDefault?: boolean }> = [];

    // Query 'backgrounds' table (Supabase & Postgres sync)
    try {
      const bgRes = await q<{
        id: string;
        name_en: string;
        video_url: string;
        poster_url: string | null;
        sort_order: number;
        is_active: boolean;
      }>(
        'SELECT id, name_en, video_url, poster_url, sort_order, is_active FROM backgrounds WHERE is_active = true ORDER BY sort_order ASC, created_at DESC'
      );

      for (const r of bgRes.rows) {
        const validUrl = normalizeStoredVideoUrl(r.video_url);
        if (validUrl) {
          videos.push({
            id: r.id,
            name: r.name_en,
            videoUrl: validUrl,
            posterUrl: r.poster_url || undefined,
            isDefault: videos.length === 0,
          });
        }
      }
    } catch (e) {
      console.warn('backgrounds table query note:', e);
    }

    // Also include custom uploads from global_background_videos if present
    try {
      const vidRes = await q<{ id: string; name: string; video_url: string; description: string | null; is_default: boolean }>(
        'SELECT id, name, video_url, description, is_default FROM global_background_videos ORDER BY is_default DESC, created_at DESC'
      );
      for (const r of vidRes.rows) {
        const validUrl = normalizeStoredVideoUrl(r.video_url);
        if (validUrl && !videos.some(v => v.videoUrl === validUrl)) {
          videos.push({
            id: r.id,
            name: r.name,
            videoUrl: validUrl,
            description: r.description || undefined,
            isDefault: Boolean(r.is_default),
          });
        }
      }
    } catch {}

    const defVid = videos.find(v => v.isDefault) || videos[0];
    if (defVid && !activeDefaultVideoUrl) {
      activeDefaultVideoUrl = defVid.videoUrl;
    }

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');

    return sendJson(res, 200, { ambientSounds, videos, activeDefaultVideoUrl });
  } catch (err) {
    return sendJson(res, 200, {
      ambientSounds: {},
      videos: [],
      activeDefaultVideoUrl: null,
    });
  }
};

export default handler;
