// POST /api/admin/reciters  { id?, name?, nameArabic?, category?, serverUrl?, imageUrl?, bio?, action? } -> add/update/delete a global reciter or sheikh photo
import { type Handler, q, qWithFallback, requireAdmin, sendJson, cleanImageUrl } from '../_lib.mjs';
import { readJsonLarge } from '../media-lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = await readJsonLarge(req);

    if (req.method === 'DELETE' || body.action === 'delete') {
      const targetId = typeof body.id === 'string' ? body.id.trim() : '';
      if (!targetId) return sendJson(res, 400, { error: 'Reciter ID is required.' });
      await q('DELETE FROM global_reciters WHERE id = $1', [targetId]);
      return sendJson(res, 200, { ok: true, id: targetId });
    }

    const rawId = typeof body.id === 'string' ? body.id.trim() : '';
    const id = /^[a-zA-Z0-9_.-]{1,128}$/.test(rawId) ? rawId : `global_${Date.now()}`;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const nameArabic = typeof body.nameArabic === 'string' ? body.nameArabic.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const serverUrl = typeof body.serverUrl === 'string' ? body.serverUrl.trim() : '';
    const rawImage = cleanImageUrl(body.imageUrl);
    const imageUrl = rawImage ? rawImage.replace(/^https?:\/\/localhost(:\d+)?/, '') : null;
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';

    // Either a name or imageUrl or serverUrl or bio must be supplied
    if (!name && !imageUrl && !serverUrl && !bio) {
      return sendJson(res, 400, { error: 'Reciter details (name, photo, bio, or server URL) are required.' });
    }

    // Ensure new metadata columns exist on global_reciters
    await q('ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS name_arabic TEXT').catch(() => {});
    await q('ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS category TEXT').catch(() => {});
    await q('ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS bio TEXT').catch(() => {});
    await q('ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS image_url TEXT').catch(() => {});

    await qWithFallback([
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, image_url, name_arabic, category, bio, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 image_url = CASE WHEN $4 IS NOT NULL THEN $4 ELSE global_reciters.image_url END,
                 name_arabic = CASE WHEN $5 <> '' THEN $5 ELSE global_reciters.name_arabic END,
                 category = CASE WHEN $6 <> '' THEN $6 ELSE global_reciters.category END,
                 bio = CASE WHEN $7 <> '' THEN $7 ELSE global_reciters.bio END,
                 updated_at = now()`,
        params: [id, name, serverUrl, imageUrl, nameArabic, category, bio],
      },
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
      reciter: {
        id,
        name: name || id,
        ...(nameArabic ? { nameArabic } : {}),
        style: 'Custom Global',
        ...(category ? { category } : {}),
        serverUrl: serverUrl || null,
        ...(imageUrl ? { imageUrl } : {}),
        ...(bio ? { bio } : {}),
      },
    });
  } catch (err) {
    console.error('admin reciters failed:', err);
    return sendJson(res, 500, { error: 'Could not save global reciter.' });
  }
};

export default handler;


