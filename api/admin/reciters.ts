// POST /api/admin/reciters  { name, serverUrl }  -> add/update a global reciter
import { type Handler, q, requireAdmin, sendJson, readJson } from '../_lib';

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = await readJson(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const serverUrl = typeof body.serverUrl === 'string' ? body.serverUrl.trim() : '';
    if (!name || !serverUrl) return sendJson(res, 400, { error: 'Name and server URL are required.' });

    const id = typeof body.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(body.id) ? body.id : `global_${Date.now()}`;
    await q(
      `INSERT INTO global_reciters (id, name, style, server_url, updated_at)
       VALUES ($1, $2, 'Custom Global', $3, now())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, server_url = EXCLUDED.server_url, updated_at = now()`,
      [id, name, serverUrl]
    );
    return sendJson(res, 201, { reciter: { id, name, style: 'Custom Global', serverUrl } });
  } catch (err) {
    console.error('admin reciters failed:', err);
    return sendJson(res, 500, { error: 'Could not save global reciter.' });
  }
};

export default handler;
