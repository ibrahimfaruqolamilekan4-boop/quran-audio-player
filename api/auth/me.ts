// GET /api/auth/me  -> { user: AppUser | null }
import { type Handler, getAuthUser, sendJson } from '../_lib';

const handler: Handler = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const user = await getAuthUser(req);
    sendJson(res, 200, { user });
  } catch (err) {
    console.error('me failed:', err);
    sendJson(res, 500, { error: 'Could not load your session.' });
  }
};

export default handler;
