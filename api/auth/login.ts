// POST /api/auth/login  { email, password }
import {
  type Handler, q, verifyPassword, createSessionToken, sessionCookie,
  sendJson, readJson, isSecureRequest, validEmail, mapUser,
} from '../_lib.mjs';

interface UserRow {
  uid: string; email: string; password_hash: string | null;
  display_name: string | null; photo_url: string | null; role: 'user' | 'admin';
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readJson(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!validEmail(email)) return sendJson(res, 400, { error: 'Please enter a valid email address.' });

    const { rows } = await q<UserRow>(
      'SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1', [email]
    );
    const row = rows[0];
    if (!row || !verifyPassword(password, row.password_hash)) {
      return sendJson(res, 401, { error: 'Incorrect email or password.' });
    }
    if (!row.password_hash) {
      return sendJson(res, 401, {
        error: 'This account was migrated from Firebase. Use the Sign up tab with this email to set a password.',
      });
    }

    await q('UPDATE users SET last_login_at = now() WHERE uid = $1', [row.uid]);
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(row.uid), isSecureRequest(req)));
    return sendJson(res, 200, { user: mapUser(row) });
  } catch (err) {
    console.error('login failed:', err);
    return sendJson(res, 500, { error: 'Could not sign you in. Please try again.' });
  }
};

export default handler;
