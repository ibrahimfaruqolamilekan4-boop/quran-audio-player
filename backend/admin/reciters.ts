// POST /api/admin/reciters  { id?, name?, serverUrl?, imageUrl?, bio? } -> add/update a global reciter or sheikh photo
import { type Handler, qWithFallback, requireAdmin, sendJson, readJson, cleanImageUrl } from '../_lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = await readJson(req);
    const rawId = typeof body.id === 'string' ? body.id.trim() : '';
    const id = /^[a-zA-Z0-9_.-]{1,128}$/.test(rawId) ? rawId : `global_${Date.now()}`;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const serverUrl = typeof body.serverUrl === 'string' ? body.serverUrl.trim() : '';
    const imageUrl = cleanImageUrl(body.imageUrl);
    const bio = typeof body.bio === 'string' ? body.bio.trim() : undefined;

    // Either a name or imageUrl or serverUrl must be supplied
    if (!name && !imageUrl && !serverUrl) {
      return sendJson(res, 400, { error: 'Reciter details (name, photo, or server URL) are required.' });
    }

    await qWithFallback([
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, image_url, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, $4, now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 image_url = CASE WHEN $4 IS NOT NULL THEN $4 ELSE global_reciters.image_url END,
                 updated_at = now()`,
        params: [id, name, serverUrl, imageUrl],
      },
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 updated_at = now()`,
        params: [id, name, serverUrl],
      },
    ]);

    return sendJson(res, 201, {
      reciter: { id, name: name || id, style: 'Custom Global', serverUrl: serverUrl || null, ...(imageUrl ? { imageUrl } : {}), ...(bio ? { bio } : {}) },
    });
  } catch (err) {
    console.error('admin reciters failed:', err);
    return sendJson(res, 500, { error: 'Could not save global reciter.' });
  }
};

export default handler;

