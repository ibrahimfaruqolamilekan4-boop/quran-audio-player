// POST /api/auth/login  { email, password }
import {
  type Handler, qStrict, verifyPassword, createSessionToken, sessionCookie,
  sendJson, readJson, isSecureRequest, validEmail, mapUser,
} from '../_lib.mjs';
import { getSupabaseAdmin } from '../lib/supabase-server';

interface UserRow {
  uid: string; email: string; password_hash: string | null;
  display_name: string | null; photo_url: string | null; role: 'user' | 'admin';
}

function authFailureStatus(err: { code?: string } | null | undefined) {
  if (err?.code === 'DB_UNAVAILABLE') return { status: 503, error: 'Sign-in is temporarily unavailable. Please try again shortly.' };
  if (err?.code === 'AUTH_MISCONFIGURED') return { status: 503, error: 'Sign-in is not configured on this server.' };
  return null;
}

const handler: Handler = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readJson(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!validEmail(email) || password.length < 8) {
      return sendJson(res, 401, { error: 'Incorrect email or password.' });
    }

    const { rows } = await qStrict<UserRow>(
      'SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1',
      [email]
    );
    const row = rows[0];

    if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
      return sendJson(res, 401, { error: 'Incorrect email or password.' });
    }

    try {
      await qStrict('UPDATE users SET last_login_at = now() WHERE uid = $1', [row.uid]);
    } catch (err) {
      console.warn('[auth] last_login update skipped:', (err as Error)?.message || err);
    }

    // Keep an existing Supabase Auth user in sync. A duplicate email is expected after the first login.
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data: sbUser } = await sb.auth.admin.createUser({
          email: row.email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: row.display_name,
            name: row.display_name,
            legacy_id: row.uid,
          },
          app_metadata: { role: row.role },
        });

        if (sbUser?.user?.id) {
          await sb
            .from('profiles')
            .update({
              legacy_id: row.uid,
              role: row.role,
              last_seen_at: new Date().toISOString(),
            })
            .eq('id', sbUser.user.id);
        }
      } catch (syncErr) {
        console.warn('JIT Supabase Auth migration notice:', syncErr);
      }
    }

    const mapped = mapUser(row);
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(mapped), isSecureRequest(req)));
    return sendJson(res, 200, { user: mapped });
  } catch (err: any) {
    const unavailable = authFailureStatus(err);
    if (unavailable) return sendJson(res, unavailable.status, { error: unavailable.error });
    console.error('login failed:', err);
    return sendJson(res, 500, { error: 'Could not sign you in. Please try again.' });
  }
};

export default handler;
