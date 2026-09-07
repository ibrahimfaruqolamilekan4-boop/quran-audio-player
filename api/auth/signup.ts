// POST /api/auth/signup  { email, password, name? }
import crypto from 'node:crypto';
import {
  type Handler, q, hashPassword, createSessionToken, sessionCookie,
  sendJson, readJson, isSecureRequest, validEmail, adminEmail, mapUser,
} from '../_lib';

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
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!validEmail(email)) return sendJson(res, 400, { error: 'Please enter a valid email address.' });
    if (password.length < 8) return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });

    const existing = await q<UserRow>('SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1', [email]);

    // Account migrated from Firebase: it has no password yet, so signup claims it.
    if (existing.rows[0] && !existing.rows[0].password_hash) {
      const row = existing.rows[0];
      const displayName = name || row.display_name;
      await q(
        'UPDATE users SET password_hash = $1, display_name = $2, last_login_at = now() WHERE uid = $3',
        [hashPassword(password), displayName, row.uid]
      );
      const user = mapUser({ ...row, password_hash: null, display_name: displayName });
      res.setHeader('Set-Cookie', sessionCookie(createSessionToken(user.uid), isSecureRequest(req)));
      return sendJson(res, 200, { user });
    }

    if (existing.rows[0]) return sendJson(res, 409, { error: 'An account with this email already exists. Please sign in instead.' });

    const uid = crypto.randomUUID();
    const role = email === adminEmail() ? 'admin' : 'user';
    const displayName = name || email.split('@')[0];
    await q(
      'INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())',
      [uid, email, hashPassword(password), displayName, role]
    );
    await q('INSERT INTO user_preferences (user_uid) VALUES ($1) ON CONFLICT DO NOTHING', [uid]);

    const user = { uid, email, displayName, photoURL: null, role } as const;
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(uid), isSecureRequest(req)));
    return sendJson(res, 201, { user });
  } catch (err) {
    console.error('signup failed:', err);
    return sendJson(res, 500, { error: 'Could not create your account. Please try again.' });
  }
};

export default handler;
