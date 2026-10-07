// GET /api/ambient -> { ambientSounds: Record<string, string>, videos: Array<{ id, name, videoUrl, description, isDefault }>, activeDefaultVideoUrl: string | null }
import { type Handler, isDbConfigured, q, sendJson } from './_lib.mjs';

const CURATED_DEFAULT_VIDEOS = [
  {
    id: 'curated_stars',
    name: 'Night Sky & Cosmos',
    videoUrl: '/videos/cosmos.mp4',
    description: 'Serene star-filled night sky loop for peaceful contemplation',
    isDefault: true,
  },
  {
    id: 'curated_rain',
    name: 'Rain on Water',
    videoUrl: '/videos/rain.mp4',
    description: 'Gentle raindrops rippling on water surface',
    isDefault: false,
  },
  {
    id: 'curated_ocean',
    name: 'Ocean Waves',
    videoUrl: '/videos/ocean.mp4',
    description: 'Gentle rolling ocean waves for tranquil reflection',
    isDefault: false,
  },
];

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!isDbConfigured()) {
    return sendJson(res, 200, {
      ambientSounds: {},
      videos: CURATED_DEFAULT_VIDEOS,
      activeDefaultVideoUrl: CURATED_DEFAULT_VIDEOS[0].videoUrl,
    });
  }
  try {
    const ambient = await q<{ id: string; video_url: string | null }>(
      'SELECT id, video_url FROM ambient_sounds WHERE video_url IS NOT NULL'
    );
    const ambientSounds: Record<string, string> = {};
    let activeDefaultVideoUrl: string | null = null;

    for (const row of ambient.rows) {
      if (row.video_url) {
        ambientSounds[row.id] = row.video_url;
        if (row.id === 'default' || row.id === 'active' || row.id === 'global') {
          activeDefaultVideoUrl = row.video_url;
        }
      }
    }

    let videos: Array<{ id: string; name: string; videoUrl: string; description?: string; isDefault?: boolean }> = [];
    try {
      const vidRes = await q<{ id: string; name: string; video_url: string; description: string | null; is_default: boolean }>(
        'SELECT id, name, video_url, description, is_default FROM global_background_videos ORDER BY is_default DESC, created_at DESC'
      );
      videos = vidRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        videoUrl: r.video_url,
        description: r.description || undefined,
        isDefault: Boolean(r.is_default),
      }));

      const defVid = videos.find(v => v.isDefault);
      if (defVid && !activeDefaultVideoUrl) {
        activeDefaultVideoUrl = defVid.videoUrl;
      }
    } catch {
      // Table may not exist yet if DB migration hasn't run
    }

    // If no videos saved in DB, supply the curated ambient loops
    if (videos.length === 0) {
      videos = CURATED_DEFAULT_VIDEOS;
      if (!activeDefaultVideoUrl) {
        activeDefaultVideoUrl = CURATED_DEFAULT_VIDEOS[0].videoUrl;
      }
    }

    return sendJson(res, 200, { ambientSounds, videos, activeDefaultVideoUrl });
  } catch (err) {
    return sendJson(res, 200, {
      ambientSounds: {},
      videos: CURATED_DEFAULT_VIDEOS,
      activeDefaultVideoUrl: CURATED_DEFAULT_VIDEOS[0].videoUrl,
    });
  }
};

export default handler;
