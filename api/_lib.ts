// Shared helpers for the /api serverless functions (Vercel) and the Vite dev middleware.
// Handlers use only standard Node req/res APIs so the same code runs in both places.
import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';

// pg is imported lazily (see getPool) so that a bundling/tracing problem with
// the driver can never prevent these serverless functions from loading.
type PgPool = { query: (text: string, params?: unknown[]) => Promise<unknown> };

export type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'user' | 'admin';
}

const SESSION_COOKIE = 'noor_session';
const SESSION_DAYS = 30;

// ---------- database ----------

let pool: PgPool | undefined;

export async function getPool(): Promise<PgPool> {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
    const mod: any = await import('pg');
    const PG = mod.default ?? mod;
    pool = new PG.Pool({ connectionString, max: 3 }) as PgPool;
  }
  return pool;
}

export async function q<T = any>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const p = await getPool();
  return p.query(text, params) as Promise<{ rows: T[] }>;
}

interface UserRow {
  uid: string;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: 'user' | 'admin';
}

export function mapUser(row: UserRow): AppUser {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    photoURL: row.photo_url,
    role: row.role,
  };
}

// ---------- passwords (scrypt, no external deps) ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ---------- sessions (HMAC-signed tokens in an httpOnly cookie) ----------

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET environment variable is not set');
  return secret;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function createSessionToken(uid: string): string {
  const payload = { uid, exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1000 };
  const data =
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function readSessionToken(req: IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function verifySessionToken(token: string): string | null {
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
export async function getAuthUser(req: IncomingMessage): Promise<AppUser | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const uid = verifySessionToken(token);
  if (!uid) return null;
  const { rows } = await q<UserRow>('SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE uid = $1', [uid]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure ? '; Secure' : ''}`;
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

// ---------- http helpers ----------

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const pre = (req as { body?: unknown }).body;
  if (pre && typeof pre === 'object' && Object.keys(pre).length > 0) return pre as Record<string, unknown>;
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
export function apiPath(req: IncomingMessage): string[] {
  const url = (req.url || '').split('?')[0];
  return url.replace(/^\/api\/?/, '').split('/').filter(Boolean);
}

export function isSecureRequest(req: IncomingMessage): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') return true;
  return (req as { encrypted?: boolean }).encrypted === true;
}

// ---------- guards ----------

export async function requireAuth(req: IncomingMessage, res: ServerResponse): Promise<AppUser | null> {
  const user = await getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Not signed in' });
    return null;
  }
  return user;
}

export async function requireAdmin(req: IncomingMessage, res: ServerResponse): Promise<AppUser | null> {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    sendJson(res, 403, { error: 'Admin access required' });
    return null;
  }
  return user;
}

export function validEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export function adminEmail(): string {
  return (process.env.ADMIN_EMAIL || 'ibrahimfaruqolamilekan4@gmail.com').toLowerCase();
}
