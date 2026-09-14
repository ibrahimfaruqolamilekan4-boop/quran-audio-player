// POST /api/admin/reciters  { id?, name, serverUrl, imageUrl? }  -> add/update a global reciter
import { type Handler, qWithFallback, requireAdmin, sendJson, readJson, cleanImageUrl } from '../_lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = await readJson(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const serverUrl = typeof body.serverUrl === 'string' ? body.serverUrl.trim() : '';
    const imageUrl = cleanImageUrl(body.imageUrl);
    if (!name || !serverUrl) return sendJson(res, 400, { error: 'Name and server URL are required.' });

    const id = typeof body.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(body.id) ? body.id : `global_${Date.now()}`;
    await qWithFallback([
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, image_url, updated_at)
               VALUES ($1, $2, 'Custom Global', $3, $4, now())
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, server_url = EXCLUDED.server_url,
                 image_url = EXCLUDED.image_url, updated_at = now()`,
        params: [id, name, serverUrl, imageUrl],
      },
      {
        // global_reciters.image_url not migrated yet (run `node scripts/apply-schema.mjs`).
        text: `INSERT INTO global_reciters (id, name, style, server_url, updated_at)
               VALUES ($1, $2, 'Custom Global', $3, now())
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, server_url = EXCLUDED.server_url,
                 updated_at = now()`,
        params: [id, name, serverUrl],
      },
    ]);
    return sendJson(res, 201, {
      reciter: { id, name, style: 'Custom Global', serverUrl, ...(imageUrl ? { imageUrl } : {}) },
    });
  } catch (err) {
    console.error('admin reciters failed:', err);
    return sendJson(res, 500, { error: 'Could not save global reciter.' });
  }
};

export default handler;
