// PUT /api/admin/role  { userId, role: 'user' | 'admin' }
import { type Handler, q, requireAdmin, sendJson, readJson } from '../_lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'PUT') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = await readJson(req);
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const role = body.role === 'admin' ? 'admin' : body.role === 'user' ? 'user' : null;
    if (!userId || !role) return sendJson(res, 400, { error: 'userId and a valid role are required.' });

    await q('UPDATE users SET role = $1 WHERE uid = $2', [role, userId]);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('admin role update failed:', err);
    return sendJson(res, 500, { error: 'Could not update role.' });
  }
};

export default handler;
