// GET /api/admin/overview -> { users, globalReciters, ambientSounds }
import { type Handler, q, requireAdmin, sendJson } from '../_lib';

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const [users, reciters, ambient] = await Promise.all([
      q('SELECT uid AS "userId", email, display_name AS "displayName", photo_url AS "photoURL", role, created_at AS "createdAt", last_login_at AS "lastLoginAt" FROM users ORDER BY created_at DESC'),
      q('SELECT id, name, style, server_url AS "serverUrl" FROM global_reciters ORDER BY updated_at DESC'),
      q('SELECT id, video_url AS "videoUrl" FROM ambient_sounds'),
    ]);

    const ambientSounds: Record<string, string> = {};
    for (const row of ambient.rows as { id: string; videoUrl: string | null }[]) {
      ambientSounds[row.id] = row.videoUrl ?? '';
    }

    sendJson(res, 200, { users: users.rows, globalReciters: reciters.rows, ambientSounds });
  } catch (err) {
    console.error('admin overview failed:', err);
    sendJson(res, 500, { error: 'Could not load admin data.' });
  }
};

export default handler;
