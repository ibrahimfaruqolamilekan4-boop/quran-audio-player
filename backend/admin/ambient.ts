// PUT /api/admin/ambient  { sounds: Record<trackId, videoUrl> }
// POST /api/admin/ambient { action: 'add_video' | 'delete_video' | 'set_default', ... }
import { type Handler, q, requireAdmin, sendJson } from '../_lib.mjs';
import { cleanPortableVideoUrl, readJsonLarge } from '../media-lib.mjs';

async function ensureTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS global_background_videos (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      video_url    TEXT NOT NULL,
      description  TEXT,
      is_default   BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    // Uploaded clips arrive as (bounded) inline payloads, which are larger than
    // the default body ceiling in _lib.mjs.
    let body: any;
    try {
      body = await readJsonLarge(req);
    } catch (err: any) {
      return sendJson(res, 413, { error: err?.message || 'Upload too large' });
    }

    if (req.method === 'PUT') {
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
    }

    if (req.method === 'POST') {
      await ensureTable().catch(() => {});
      const action = body.action;

      if (action === 'add_video') {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        // Only values other devices can actually load are stored: a hosted URL,
        // a bundled /videos path, or a bounded inline upload.
        const videoUrl = cleanPortableVideoUrl(body.videoUrl) || '';
        const description = typeof body.description === 'string' ? body.description.trim() : null;
        const isDefault = Boolean(body.isDefault);

        if (!name || !videoUrl) {
          return sendJson(res, 400, {
            error: 'A name and a playable video source are required (hosted MP4/WebM link, bundled /videos path, or an upload under ~3 MB).',
          });
        }

        const id = `bg_vid_${Date.now()}`;
        if (isDefault) {
          await q('UPDATE global_background_videos SET is_default = false');
          await q(
            `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
             VALUES ('default', 'Default Video', $1, now())
             ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
            [videoUrl]
          );
        }

        await q(
          `INSERT INTO global_background_videos (id, name, video_url, description, is_default, created_at)
           VALUES ($1, $2, $3, $4, $5, now())`,
          [id, name, videoUrl, description, isDefault]
        );

        return sendJson(res, 201, { video: { id, name, videoUrl, description, isDefault } });
      }

      if (action === 'delete_video') {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) return sendJson(res, 400, { error: 'Video ID required' });
        await q('DELETE FROM global_background_videos WHERE id = $1', [id]);
        return sendJson(res, 200, { ok: true });
      }

      if (action === 'set_default') {
        const id = typeof body.id === 'string' ? body.id : '';
        const videoUrl = cleanPortableVideoUrl(body.videoUrl) || '';
        if (!id && !videoUrl) return sendJson(res, 400, { error: 'Video ID or URL required' });

        if (id) {
          await q('UPDATE global_background_videos SET is_default = (id = $1)', [id]);
        }
        if (videoUrl) {
          await q(
            `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
             VALUES ('default', 'Default Video', $1, now())
             ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
            [videoUrl]
          );
        }
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 400, { error: 'Unknown action' });
    }
  } catch (err: any) {
    console.error('admin ambient failed:', err);
    return sendJson(res, 500, { error: err?.message || 'Could not save ambient settings.' });
  }
};

export default handler;
