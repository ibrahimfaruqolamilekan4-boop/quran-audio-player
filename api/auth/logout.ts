// POST /api/auth/logout
import { type Handler, sendJson, clearedSessionCookie, isSecureRequest } from '../_lib.mjs';

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  res.setHeader('Set-Cookie', clearedSessionCookie(isSecureRequest(req)));
  sendJson(res, 200, { ok: true });
};

export default handler;
