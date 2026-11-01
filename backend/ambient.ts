// GET /api/ambient -> { ambientSounds: Record<string, string>, videos: Array<CustomVideo>, activeDefaultVideoUrl: string | null, version: number }
import { type Handler, q, sendJson } from './_lib.mjs';
import { getActiveBackgroundsAndVersion } from './backgrounds';

function normalizeStoredVideoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim().replace(/^https?:\/\/localhost(:\d+)?/, '');
  if (!url || url.startsWith('blob:')) return null;
  return url;
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const { backgrounds, version, updated_at } = await getActiveBackgroundsAndVersion();

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

    const videos: Array<any> = [];

    for (const r of backgrounds) {
      const validUrl = normalizeStoredVideoUrl(r.video_url);
      if (validUrl) {
        videos.push({
          id: r.id,
          name: r.name_en,
          category: r.category || 'nature',
          videoUrl: validUrl,
          videoUrl720p: normalizeStoredVideoUrl(r.video_url_720p) || validUrl,
          videoUrl480p: normalizeStoredVideoUrl(r.video_url_480p) || undefined,
          posterUrl: r.poster_url || undefined,
          poster_url: r.poster_url || undefined,
          renditions: Array.isArray(r.renditions) ? r.renditions : undefined,
          attribution: r.attribution || undefined,
          sourceUrl: r.source_url || undefined,
          creator: r.creator || undefined,
          licenseName: r.license_name || undefined,
          licenseUrl: r.license_url || undefined,
          dateChecked: r.date_checked || undefined,
          attributionRequired: Boolean(r.attribution_required),
          sizeBytes: Number(r.size_bytes || 0),
          durationSeconds: Number(r.duration_seconds || 0),
          isActive: true,
          isDefault: videos.length === 0,
        });
      }
    }

    // Also include custom uploads from global_background_videos if present
    try {
      const vidRes = await q<{ id: string; name: string; video_url: string; description: string | null; is_default: boolean }>(
        'SELECT id, name, video_url, description, is_default FROM global_background_videos ORDER BY is_default DESC, created_at DESC'
      );
      for (const r of vidRes.rows) {
        const validUrl = normalizeStoredVideoUrl(r.video_url);
        if (validUrl && !videos.some(v => v.videoUrl === validUrl || v.id === r.id)) {
          videos.push({
            id: r.id,
            name: r.name,
            videoUrl: validUrl,
            description: r.description || undefined,
            isDefault: videos.length === 0 && Boolean(r.is_default),
          });
        }
      }
    } catch {}

    const defVid = videos.find(v => v.isDefault) || videos[0];
    if (defVid && !activeDefaultVideoUrl) {
      activeDefaultVideoUrl = defVid.videoUrl;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return sendJson(res, 200, {
      ambientSounds,
      videos,
      activeDefaultVideoUrl,
      version,
      updated_at,
    });
  } catch (err) {
    return sendJson(res, 200, {
      ambientSounds: {},
      videos: [],
      activeDefaultVideoUrl: null,
      version: 1,
    });
  }
};

export default handler;
