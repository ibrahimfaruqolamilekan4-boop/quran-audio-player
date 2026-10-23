// GET /api/ambient -> { ambientSounds: Record<string, string>, videos: Array<{ id, name, videoUrl, description, isDefault }>, activeDefaultVideoUrl: string | null }
import { type Handler, q, sendJson } from './_lib.mjs';

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
  {
    id: 'curated_nature',
    name: 'Sacred Nature',
    videoUrl: '/videos/nature.mp4',
    description: 'Peaceful nature breeze',
    isDefault: false,
  },
  {
    id: 'curated_clouds',
    name: 'Serene Clouds & Sky',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-clouds-and-blue-sky-2408-large.mp4',
    description: 'Sunlit gentle cloud movement',
    isDefault: false,
  },
  {
    id: 'curated_mountains',
    name: 'Mountain Mist & Rain',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-mountain-range-under-a-gloomy-sky-40436-large.mp4',
    description: 'Moody mountain peaks with mist',
    isDefault: false,
  },
  {
    id: 'curated_night_stars',
    name: 'Midnight Galaxy',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-the-night-sky-22920-large.mp4',
    description: 'Deep cosmic starscape',
    isDefault: false,
  },
  {
    id: 'curated_sunset',
    name: 'Golden Ocean Sunset',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-sun-setting-over-the-ocean-1224-large.mp4',
    description: 'Golden reflection over calm waters',
    isDefault: false,
  },
];

function normalizeStoredVideoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim().replace(/^https?:\/\/localhost(:\d+)?/, '');
  if (!url || url.startsWith('blob:')) return null;
  return url;
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
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

    let videos: Array<{ id: string; name: string; videoUrl: string; description?: string; isDefault?: boolean }> = [];
    try {
      const vidRes = await q<{ id: string; name: string; video_url: string; description: string | null; is_default: boolean }>(
        'SELECT id, name, video_url, description, is_default FROM global_background_videos ORDER BY is_default DESC, created_at DESC'
      );
      for (const r of vidRes.rows) {
        const validUrl = normalizeStoredVideoUrl(r.video_url);
        if (validUrl) {
          videos.push({
            id: r.id,
            name: r.name,
            videoUrl: validUrl,
            description: r.description || undefined,
            isDefault: Boolean(r.is_default),
          });
        }
      }

      const customVideosInDb = videos.filter(v => !v.id.startsWith('curated_'));
      const defVid = customVideosInDb.find(v => v.isDefault) || videos.find(v => v.isDefault);
      if (defVid && (!activeDefaultVideoUrl || activeDefaultVideoUrl === '/videos/cosmos.mp4')) {
        activeDefaultVideoUrl = defVid.videoUrl;
      } else if ((!activeDefaultVideoUrl || activeDefaultVideoUrl === '/videos/cosmos.mp4') && customVideosInDb.length > 0) {
        activeDefaultVideoUrl = customVideosInDb[0].videoUrl;
      }
    } catch {
      // Table may not exist yet if DB migration hasn't run
    }

    // Ensure curated ambient loops are always available alongside admin uploads
    for (const curated of CURATED_DEFAULT_VIDEOS) {
      if (!videos.some(v => v.videoUrl === curated.videoUrl)) {
        videos.push({
          ...curated,
          isDefault: videos.length === 0 ? curated.isDefault : false,
        });
      }
    }

    return sendJson(res, 200, { ambientSounds, videos, activeDefaultVideoUrl });
  } catch (err) {
    return sendJson(res, 200, {
      ambientSounds: {},
      videos: CURATED_DEFAULT_VIDEOS,
      activeDefaultVideoUrl: null,
    });
  }
};

export default handler;


