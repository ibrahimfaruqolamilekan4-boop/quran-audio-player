// Shared helpers for the /api endpoints.
//
// Everything in backend/ is bundled by scripts/build-function.mjs (esbuild)
// into the single catch-all function at api/[...slug].mjs, which is the only
// file Vercel deploys. Plain ESM JavaScript here keeps the source readable and
// the bundle self-contained regardless of which bundler version runs the build.
// Types for this module live in _lib.d.mts.
import crypto from 'node:crypto';

const SESSION_COOKIE = 'noor_session';
const SESSION_DAYS = 30;

// ---------- database ----------

let pool;

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

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

// In-memory fallback database for local dev or when Neon/Postgres is not connected
const fallbackUsers = [
  {
    uid: 'usr_admin_ibrahim',
    email: 'ibrahimfaruqolamilekan4@gmail.com',
    password_hash: null,
    display_name: 'Ibrahim Faruq (Admin)',
    photo_url: null,
    role: 'admin',
    created_at: '2026-03-01T12:00:00Z',
    last_login_at: '2026-10-10T08:00:00Z',
  },
  {
    uid: 'usr_member_omar',
    email: 'omar.zaid@nooraya.app',
    password_hash: null,
    display_name: 'Omar Zaid',
    photo_url: null,
    role: 'user',
    created_at: '2026-04-12T14:30:00Z',
    last_login_at: '2026-10-09T18:20:00Z',
  },
  {
    uid: 'usr_member_ahmed',
    email: 'hafiz.ahmed@example.com',
    password_hash: null,
    display_name: 'Ahmed Al-Banna',
    photo_url: null,
    role: 'user',
    created_at: '2026-05-20T09:15:00Z',
    last_login_at: '2026-10-10T05:40:00Z',
  },
  {
    uid: 'usr_member_mariam',
    email: 'mariam.khalid@example.com',
    password_hash: null,
    display_name: 'Mariam Khalid',
    photo_url: null,
    role: 'user',
    created_at: '2026-06-18T16:00:00Z',
    last_login_at: '2026-10-08T21:10:00Z',
  },
  {
    uid: 'usr_member_yusuf',
    email: 'yusuf.mansour@example.com',
    password_hash: null,
    display_name: 'Yusuf Mansour',
    photo_url: null,
    role: 'user',
    created_at: '2026-08-05T11:45:00Z',
    last_login_at: '2026-10-09T12:05:00Z',
  },
];

import fs from 'node:fs';
import path from 'node:path';

const STORE_FILE = path.resolve(process.cwd(), '.server_store.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      if (data && typeof data === 'object') return data;
    }
  } catch {}
  return {
    global_reciters: [],
    global_videos: [
      { id: 'curated_stars', name: 'Night Sky & Cosmos', video_url: '/videos/cosmos.mp4', description: 'Serene star-filled night sky loop', is_default: true },
      { id: 'curated_rain', name: 'Rain on Water', video_url: '/videos/rain.mp4', description: 'Gentle raindrops rippling on water surface', is_default: false },
      { id: 'curated_ocean', name: 'Ocean Waves', video_url: '/videos/ocean.mp4', description: 'Gentle rolling ocean waves', is_default: false },
      { id: 'curated_nature', name: 'Sacred Nature', video_url: '/videos/nature.mp4', description: 'Peaceful nature breeze', is_default: false },
    ],
    ambient_sounds: {
      default: '/videos/cosmos.mp4',
    },
    users: fallbackUsers,
  };
}

let serverStore = loadStore();

function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist server store:', err);
  }
}

export async function q(text, params = []) {
  if (isDbConfigured()) {
    const p = await getPool();
    return p.query(text, params);
  }

  // Graceful persistent query emulation for development, preview, and mobile devices
  const qStr = String(text || '').trim();

  // 1. Users
  if (qStr.includes('FROM users') || qStr.includes('UPDATE users') || qStr.includes('INSERT INTO users')) {
    if (qStr.startsWith('SELECT uid, email') && params[0]) {
      const u = serverStore.users.find(x => x.email === params[0] || x.uid === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (qStr.startsWith('SELECT uid AS "userId"') || qStr.includes('ORDER BY created_at')) {
      const rows = serverStore.users.map(u => ({
        userId: u.uid,
        email: u.email,
        displayName: u.display_name,
        photoURL: u.photo_url,
        role: u.role,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      }));
      return { rows };
    }
    if (qStr.startsWith('UPDATE users SET role = $1 WHERE uid = $2')) {
      const u = serverStore.users.find(x => x.uid === params[1]);
      if (u) {
        u.role = params[0];
        saveStore();
      }
      return { rowCount: u ? 1 : 0, rows: [] };
    }
    if (qStr.includes('UPDATE users SET')) {
      const u = serverStore.users.find(x => x.uid === params[params.length - 1] || x.email === params[params.length - 1]);
      if (u && params[0]) u.password_hash = params[0];
      if (u && params[1]) u.display_name = params[1];
      saveStore();
      return { rowCount: 1, rows: [] };
    }
    if (qStr.startsWith('INSERT INTO users')) {
      const [uid, email, passHash, dispName, role] = params;
      const newUser = {
        uid,
        email,
        password_hash: passHash,
        display_name: dispName,
        photo_url: null,
        role: role || 'user',
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };
      serverStore.users.push(newUser);
      saveStore();
      return { rowCount: 1, rows: [newUser] };
    }
    return { rows: serverStore.users };
  }

  // 2. Global Reciters (Sheikhs & Profile Pictures)
  if (qStr.includes('global_reciters') || qStr.includes('custom_reciters')) {
    if (qStr.startsWith('SELECT')) {
      return { rows: serverStore.global_reciters };
    }
    if (qStr.includes('INSERT INTO global_reciters') || qStr.includes('INSERT INTO custom_reciters')) {
      const id = params[0];
      const name = typeof params[1] === 'string' && params[1].trim() ? params[1].trim() : id;
      const serverUrl = typeof params[2] === 'string' ? params[2].trim() : '';
      const imageUrl = params[3] !== undefined ? params[3] : (params.find(p => typeof p === 'string' && (p.startsWith('data:image') || (p !== serverUrl && p.includes('/')))) || null);
      
      const existingIdx = serverStore.global_reciters.findIndex(r => r.id === id);
      const prev = existingIdx >= 0 ? serverStore.global_reciters[existingIdx] : null;
      const reciterRow = {
        id,
        name: name || prev?.name || id,
        style: prev?.style || 'Custom Global',
        server_url: serverUrl || prev?.server_url || '',
        image_url: imageUrl !== null && imageUrl !== undefined ? imageUrl : prev?.image_url,
      };
      if (existingIdx >= 0) {
        serverStore.global_reciters[existingIdx] = reciterRow;
      } else {
        serverStore.global_reciters.push(reciterRow);
      }
      saveStore();
      return { rowCount: 1, rows: [reciterRow] };
    }
    if (qStr.includes('DELETE FROM global_reciters WHERE id = $1')) {
      const targetId = params[0];
      serverStore.global_reciters = serverStore.global_reciters.filter(r => r.id !== targetId);
      saveStore();
      return { rowCount: 1, rows: [] };
    }
  }

  // 3. Global Background Videos
  if (qStr.includes('global_background_videos')) {
    if (qStr.startsWith('SELECT')) {
      return { rows: serverStore.global_videos };
    }
    if (qStr.includes('INSERT INTO global_background_videos')) {
      const [id, name, videoUrl, description, isDefault] = params;
      const vidRow = {
        id,
        name,
        video_url: videoUrl,
        description: description || null,
        is_default: Boolean(isDefault),
        created_at: new Date().toISOString(),
      };
      const existingIdx = serverStore.global_videos.findIndex(v => v.id === id || v.video_url === videoUrl);
      if (existingIdx >= 0) {
        serverStore.global_videos[existingIdx] = { ...serverStore.global_videos[existingIdx], ...vidRow };
      } else {
        serverStore.global_videos.unshift(vidRow);
      }
      saveStore();
      return { rowCount: 1, rows: [vidRow] };
    }
    if (qStr.includes('UPDATE global_background_videos SET is_default = false')) {
      serverStore.global_videos.forEach(v => { v.is_default = false; });
      saveStore();
      return { rowCount: serverStore.global_videos.length, rows: [] };
    }
    if (qStr.includes('UPDATE global_background_videos SET is_default = (id = $1)')) {
      const targetId = params[0];
      serverStore.global_videos.forEach(v => { v.is_default = (v.id === targetId || v.video_url === targetId); });
      saveStore();
      return { rowCount: 1, rows: [] };
    }
    if (qStr.includes('DELETE FROM global_background_videos WHERE id = $1')) {
      const targetId = params[0];
      serverStore.global_videos = serverStore.global_videos.filter(v => v.id !== targetId);
      saveStore();
      return { rowCount: 1, rows: [] };
    }
  }

  // 4. Ambient Sounds Mapping
  if (qStr.includes('ambient_sounds')) {
    if (qStr.startsWith('SELECT')) {
      const rows = Object.entries(serverStore.ambient_sounds).map(([k, v]) => ({
        id: k,
        video_url: v,
      }));
      return { rows };
    }
    if (qStr.includes('INSERT INTO ambient_sounds')) {
      const [id, url] = params;
      serverStore.ambient_sounds[id] = url;
      saveStore();
      return { rowCount: 1, rows: [] };
    }
  }

  if (qStr.includes('user_preferences')) {
    return { rowCount: 1, rows: [] };
  }

  return { rows: [] };
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
  if (!secret) return 'nooraya-local-secret-for-session-signing';
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

/** Returns the logged-in user (fresh from DB or fallback store so role changes apply immediately), or null. */
export async function getAuthUser(req) {
  const token = readSessionToken(req);
  if (token) {
    const uid = verifySessionToken(token);
    if (uid) {
      try {
        const { rows } = await q(
          'SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE uid = $1',
          [uid]
        );
        if (rows[0]) return mapUser(rows[0]);
      } catch {}
    }
  }

  // In local dev/preview without full DB session cookie, provide default admin user
  if (!isDbConfigured()) {
    const defaultAdmin = fallbackUsers[0];
    return mapUser(defaultAdmin);
  }

  return null;
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
  const isAdm = user.role === 'admin' || (user.email && user.email.toLowerCase() === adminEmail());
  if (!isAdm) {
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

/**
 * Normalise an optional image link from the client. Supports absolute http(s) URLs,
 * local relative paths (/uploads/...), and compressed data:image base64 URLs up to 1.5MB.
 */
export function cleanImageUrl(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    return url.length <= 5_000_000 ? url : null;
  }
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Run each query in order until one succeeds. Used for columns that are added by a
 * migration which may not have been applied to the database yet: Postgres reports
 * 42703 (undefined_column) for those, and the next variant — which omits the column —
 * is used instead. Without this, a pending migration would break reciter sync.
 */
export async function qWithFallback(queries) {
  let lastError;
  for (const { text, params } of queries) {
    try {
      return await q(text, params);
    } catch (err) {
      if (err && err.code === '42703') {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
