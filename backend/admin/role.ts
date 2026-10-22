// PUT /api/admin/role  { userId, role: 'user' | 'admin' }
// POST /api/admin/role { action: 'add_user' | 'delete_user', email, displayName, role, userId }
import crypto from 'node:crypto';
import { type Handler, q, requireAdmin, sendJson, readJson, validEmail, adminEmail } from '../_lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = await readJson(req);

    if (req.method === 'POST') {
      const action = typeof body.action === 'string' ? body.action : 'add_user';
      if (action === 'delete_user') {
        const userId = typeof body.userId === 'string' ? body.userId : '';
        if (!userId) return sendJson(res, 400, { error: 'userId is required' });
        await q('DELETE FROM users WHERE uid = $1', [userId]);
        return sendJson(res, 200, { ok: true });
      }

      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const displayName = typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim()
        : email.split('@')[0];
      const role = body.role === 'admin' || email === adminEmail() ? 'admin' : 'user';

      if (!validEmail(email)) {
        return sendJson(res, 400, { error: 'Please enter a valid email address.' });
      }

      const uid = `usr_${crypto.randomUUID().slice(0, 8)}`;
      await q(
        'INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now()) ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role',
        [uid, email, null, displayName, role]
      );

      const { rows } = await q(
        'SELECT uid AS "userId", email, display_name AS "displayName", photo_url AS "photoURL", role, created_at AS "createdAt", last_login_at AS "lastLoginAt" FROM users ORDER BY created_at DESC LIMIT 200'
      );
      return sendJson(res, 200, { ok: true, users: rows });
    }

    const userId = typeof body.userId === 'string' ? body.userId : '';
    const role = body.role === 'admin' ? 'admin' : body.role === 'user' ? 'user' : null;
    if (!userId || !role) return sendJson(res, 400, { error: 'userId and a valid role are required.' });

    await q('UPDATE users SET role = $1 WHERE uid = $2', [role, userId]);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('admin role update failed:', err);
    return sendJson(res, 500, { error: 'Could not update user.' });
  }
};

export default handler;
