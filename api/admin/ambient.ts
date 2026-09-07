// PUT /api/admin/ambient  { sounds: Record<trackId, videoUrl> }
import { type Handler, q, requireAdmin, sendJson, readJson } from '../_lib';

const handler: Handler = async (req, res) => {
  if (req.method !== 'PUT') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = await readJson(req);
    const sounds = (body.sounds && typeof body.sounds === 'object') ? body.sounds as Record<string, unknown> : {};

    for (const [id, url] of Object.entries(sounds)) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) continue;
      const videoUrl = typeof url === 'string' && url.trim() ? url.trim() : null;
      await q(
        `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
         VALUES ($1, $1, $2, now())
         ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
        [id, videoUrl]
      );
    }
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('admin ambient failed:', err);
    return sendJson(res, 500, { error: 'Could not save ambient settings.' });
  }
};

export default handler;
