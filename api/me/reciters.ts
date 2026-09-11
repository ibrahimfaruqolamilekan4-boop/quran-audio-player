// GET  /api/me/reciters  -> { reciters: [{ id, name, style, serverUrl, imageUrl }] }
// POST /api/me/reciters  { id?, name, style?, serverUrl, imageUrl? }
import { type Handler, qWithFallback, requireAuth, sendJson, readJson, cleanImageUrl } from '../_lib.mjs';

interface ReciterRow {
  id: string;
  name: string;
  style: string | null;
  server_url: string;
  image_url?: string | null;
}

const mapRow = (r: ReciterRow) => ({
  id: r.id,
  name: r.name,
  style: r.style ?? 'Custom',
  serverUrl: r.server_url,
  ...(r.image_url ? { imageUrl: r.image_url } : {}),
});

const handler: Handler = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (req.method === 'GET') {
      const { rows } = await qWithFallback<ReciterRow>([
        {
          text: 'SELECT id, name, style, server_url, image_url FROM custom_reciters WHERE user_uid = $1 ORDER BY created_at',
          params: [user.uid],
        },
        {
          // custom_reciters.image_url not migrated yet (run `node scripts/apply-schema.mjs`).
          text: 'SELECT id, name, style, server_url FROM custom_reciters WHERE user_uid = $1 ORDER BY created_at',
          params: [user.uid],
        },
      ]);
      return sendJson(res, 200, { reciters: rows.map(mapRow) });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const serverUrl = typeof body.serverUrl === 'string' ? body.serverUrl.trim() : '';
      const style = typeof body.style === 'string' ? body.style : 'Custom';
      const imageUrl = cleanImageUrl(body.imageUrl);
      const id = typeof body.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(body.id)
        ? body.id
        : `custom_${Date.now()}`;

      if (!name || !serverUrl) return sendJson(res, 400, { error: 'Reciter name and server URL are required.' });

      await qWithFallback([
        {
          text: `INSERT INTO custom_reciters (id, user_uid, name, style, server_url, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style = EXCLUDED.style,
                   server_url = EXCLUDED.server_url, image_url = EXCLUDED.image_url`,
          params: [id, user.uid, name, style, serverUrl, imageUrl],
        },
        {
          text: `INSERT INTO custom_reciters (id, user_uid, name, style, server_url)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style = EXCLUDED.style,
                   server_url = EXCLUDED.server_url`,
          params: [id, user.uid, name, style, serverUrl],
        },
      ]);
      return sendJson(res, 201, { reciter: { id, name, style, serverUrl, ...(imageUrl ? { imageUrl } : {}) } });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('custom reciters failed:', err);
    return sendJson(res, 500, { error: 'Could not save reciter.' });
  }
};

export default handler;
