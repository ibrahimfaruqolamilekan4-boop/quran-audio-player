// POST /api/auth/signup  { email, password, name? }
import crypto from 'node:crypto';
import {
  type Handler, qStrict, hashPassword, createSessionToken, sessionCookie,
  sendJson, readJson, isSecureRequest, validEmail, adminEmail,
} from '../_lib.mjs';
import { getSupabaseAdmin } from '../lib/supabase-server';

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

    const existing = await qStrict<UserRow>('SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1', [email]);

    if (existing.rows[0]) return sendJson(res, 409, { error: 'An account with this email already exists. Please sign in instead.' });

    let uid = crypto.randomUUID();
    const role = adminEmail() && email === adminEmail() ? 'admin' : 'user';
    const displayName = name || email.split('@')[0];

    // 1. Create in Supabase Auth (Primary source of truth)
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data: sbUser, error: sbErr } = await sb.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: displayName, name: displayName },
          app_metadata: { role },
        });
        if (sbUser?.user?.id) {
          uid = sbUser.user.id;
        } else if (sbErr) {
          console.warn('Supabase auth signup notice:', sbErr.message);
        }
      } catch (sbEx) {
        console.warn('Supabase auth signup exception:', sbEx);
      }
    }

    // 2. Insert into Neon Postgres & server store
    await qStrict(
      'INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())',
      [uid, email, hashPassword(password), displayName, role]
    );
    await qStrict('INSERT INTO user_preferences (user_uid) VALUES ($1) ON CONFLICT DO NOTHING', [uid]);

    const user = { uid, email, displayName, photoURL: null, role } as const;
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(user), isSecureRequest(req)));
    return sendJson(res, 201, { user });
  } catch (err: any) {
    if (err?.code === 'DB_UNAVAILABLE') {
      return sendJson(res, 503, { error: 'Sign-up is temporarily unavailable. Please try again shortly.' });
    }
    if (err?.code === 'AUTH_MISCONFIGURED') {
      return sendJson(res, 503, { error: 'Sign-up is not configured on this server.' });
    }
    console.error('signup failed:', err);
    return sendJson(res, 500, { error: 'Could not create your account. Please try again.' });
  }
};

export default handler;
