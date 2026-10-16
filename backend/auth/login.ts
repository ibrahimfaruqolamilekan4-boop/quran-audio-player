// POST /api/auth/login  { email, password }
import {
  type Handler, q, verifyPassword, hashPassword, createSessionToken, sessionCookie,
  sendJson, readJson, isSecureRequest, validEmail, adminEmail, mapUser,
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

    let row: UserRow | undefined;
    try {
      const { rows } = await q<UserRow>(
        'SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1', [email]
      );
      row = rows[0];
    } catch (e) {
      console.warn('DB query in login fallback notice:', e);
    }

    // Auto-recognize pre-seeded admin email if not yet inserted into DB
    if (!row && email === adminEmail()) {
      row = {
        uid: 'usr_admin_ibrahim',
        email: adminEmail(),
        password_hash: null,
        display_name: 'Ibrahim Faruq (Admin)',
        photo_url: null,
        role: 'admin',
      };
    }

    if (!row) {
      return sendJson(res, 401, { error: 'Incorrect email or password.' });
    }

    if (!row.password_hash) {
      // First-time sign-in for pre-seeded user or admin: claim and save password
      try {
        await q('UPDATE users SET password_hash = $1, last_login_at = now() WHERE uid = $2', [hashPassword(password), row.uid]);
      } catch (e) {
        console.warn('Password save notice:', e);
      }
      res.setHeader('Set-Cookie', sessionCookie(createSessionToken(row.uid), isSecureRequest(req)));
      return sendJson(res, 200, { user: mapUser(row) });
    }

    if (!verifyPassword(password, row.password_hash)) {
      return sendJson(res, 401, { error: 'Incorrect email or password.' });
    }

    try {
      await q('UPDATE users SET last_login_at = now() WHERE uid = $1', [row.uid]);
    } catch {}
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(row.uid), isSecureRequest(req)));
    return sendJson(res, 200, { user: mapUser(row) });
  } catch (err: any) {
    console.error('login failed:', err);
    return sendJson(res, 500, { error: err?.message || 'Could not sign you in. Please try again.' });
  }
};

export default handler;
