// Shared helpers for the /api serverless functions.
//
// This file is intentionally plain ESM JavaScript (not TypeScript): Vercel
// transpiles each api/*.ts file individually without bundling, so an
// extensionless import of a TypeScript helper resolves to a module that does
// not exist at runtime (ERR_MODULE_NOT_FOUND for /var/task/api/_lib). Keeping
// the shared code as a real .mjs file means the runtime path always exists.
// Types for this module live in _lib.d.mts.
import crypto from 'node:crypto';

const SESSION_COOKIE = 'noor_session';
const SESSION_DAYS = 30;

// ---------- database ----------

let pool;

/**
 * pg is imported lazily so a driver/bundling problem can never stop a serverless
 * function from loading.
 */
export async function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
    const mod = await import('pg');
    const PG = mod.default ?? mod;
    pool = new PG.Pool({ connectionString, max: 3 });
  }
  return pool;
}

export async function q(text, params) {
  const p = await getPool();
  return p.query(text, params);
}

export function mapUser(row) {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    photoURL: row.photo_url,
    role: row.role,
  };
}

// ---------- passwords (scrypt, no external deps) ----------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ---------- sessions (HMAC-signed tokens in an httpOnly cookie) ----------

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET environment variable is not set');
  return secret;
}

function sign(data) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function createSessionToken(uid) {
  const payload = { uid, exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1000 };
  const data =
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function readSessionToken(req) {
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function verifySessionToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = sign(data);
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

/** Returns the logged-in user (fresh from DB so role changes apply immediately), or null. */
export async function getAuthUser(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const uid = verifySessionToken(token);
  if (!uid) return null;
  const { rows } = await q(
    'SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE uid = $1',
    [uid]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export function sessionCookie(token, secure) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure ? '; Secure' : ''}`;
}

export function clearedSessionCookie(secure) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

// ---------- http helpers ----------

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function readJson(req) {
  const pre = req.body;
  if (pre && typeof pre === 'object' && Object.keys(pre).length > 0) return Promise.resolve(pre);
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/** Path segments after "/api", e.g. /api/me/reciters/abc -> ['me','reciters','abc'] */
export function apiPath(req) {
  const url = (req.url || '').split('?')[0];
  return url.replace(/^\/api\/?/, '').split('/').filter(Boolean);
}

export function isSecureRequest(req) {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') return true;
  return req.encrypted === true;
}

// ---------- guards ----------

export async function requireAuth(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Not signed in' });
    return null;
  }
  return user;
}

export async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    sendJson(res, 403, { error: 'Admin access required' });
    return null;
  }
  return user;
}

export function validEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export function adminEmail() {
  return (process.env.ADMIN_EMAIL || 'ibrahimfaruqolamilekan4@gmail.com').toLowerCase();
}
