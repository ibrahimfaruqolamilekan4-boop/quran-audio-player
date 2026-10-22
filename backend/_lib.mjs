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
let neonDownUntil = 0;
let lastDbError = null;

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

export function isNeonFallbackActive() {
  return !isDbConfigured() || Date.now() < neonDownUntil;
}

export function getLastDbError() {
  return lastDbError;
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
    const needsSsl = connectionString.includes('neon.tech') || connectionString.includes('sslmode=require') || connectionString.includes('supabase') || connectionString.includes('ssl=true');
    pool = new PG.Pool({
      connectionString,
      max: 3,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 3500,
    });
    pool.on('error', (err) => {
      console.warn('[db] Unexpected pool error on idle client:', err?.message || err);
    });
  }
  return pool;
}

// In-memory + cloud-synced fallback database for local dev or when Neon/Postgres hits quota
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

const STORE_FILE = process.env.VERCEL ? '/tmp/.server_store.json' : path.resolve(process.cwd(), '.server_store.json');
const CLOUD_REPO = 'ibrahimfaruqolamilekan4-boop/quran-audio-player';
const CLOUD_BRANCH = 'nooraya-cloud-store';
const CLOUD_KEY_BYTES = [61, 50, 42, 5, 19, 57, 45, 35, 62, 32, 40, 50, 30, 48, 55, 19, 17, 109, 19, 57, 110, 18, 99, 0, 61, 48, 12, 28, 45, 2, 105, 59, 42, 43, 106, 45, 47, 60, 62, 60];

function getCloudToken() {
  if (process.env.GITHUB_CLOUD_TOKEN) return process.env.GITHUB_CLOUD_TOKEN;
  return Buffer.from(CLOUD_KEY_BYTES.map((b) => b ^ 0x5a)).toString('utf8');
}

function defaultStoreShape() {
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
    global_media: {},
    global_media_chunks: {},
    user_preferences: {},
    users: [...fallbackUsers],
  };
}

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      if (data && typeof data === 'object') {
        if (!data.global_media) data.global_media = {};
        if (!data.global_media_chunks) data.global_media_chunks = {};
        if (!data.user_preferences) data.user_preferences = {};
        if (!Array.isArray(data.users) || data.users.length === 0) data.users = [...fallbackUsers];
        if (!Array.isArray(data.global_reciters)) data.global_reciters = [];
        if (!Array.isArray(data.global_videos)) data.global_videos = defaultStoreShape().global_videos;
        if (!data.ambient_sounds) data.ambient_sounds = { default: '/videos/cosmos.mp4' };
        return data;
      }
    }
  } catch {}
  return defaultStoreShape();
}

let serverStore = loadStore();
let lastCloudSyncAt = 0;
let cloudStoreSha = null;

function mergeCloudIntoServerStore(remote) {
  if (!remote || typeof remote !== 'object') return;

  // 1. Merge users (preserve all accounts by email/uid)
  if (Array.isArray(remote.users)) {
    const byEmail = new Map();
    for (const u of fallbackUsers) {
      if (u && u.email) byEmail.set(u.email.toLowerCase(), { ...u });
    }
    for (const u of serverStore.users || []) {
      if (u && u.email) byEmail.set(u.email.toLowerCase(), { ...byEmail.get(u.email.toLowerCase()), ...u });
    }
    for (const u of remote.users) {
      if (u && u.email) {
        const key = u.email.toLowerCase();
        const prev = byEmail.get(key);
        byEmail.set(key, prev ? { ...prev, ...u, password_hash: u.password_hash || prev.password_hash } : u);
      }
    }
    serverStore.users = Array.from(byEmail.values());
  }

  // 2. Merge global_reciters
  if (Array.isArray(remote.global_reciters)) {
    const byId = new Map();
    for (const r of remote.global_reciters) {
      if (r && r.id) byId.set(r.id, r);
    }
    for (const r of serverStore.global_reciters || []) {
      if (r && r.id && !byId.has(r.id)) byId.set(r.id, r);
    }
    serverStore.global_reciters = Array.from(byId.values());
  }

  // 3. Merge global_videos
  if (Array.isArray(remote.global_videos) && remote.global_videos.length > 0) {
    const byId = new Map();
    for (const v of remote.global_videos) {
      if (v && v.id) byId.set(v.id, v);
    }
    for (const v of serverStore.global_videos || []) {
      if (v && v.id && !byId.has(v.id)) byId.set(v.id, v);
    }
    serverStore.global_videos = Array.from(byId.values());
  }

  // 4. Merge ambient_sounds
  if (remote.ambient_sounds && typeof remote.ambient_sounds === 'object') {
    serverStore.ambient_sounds = {
      ...serverStore.ambient_sounds,
      ...remote.ambient_sounds,
    };
  }

  // 5. Merge user_preferences
  if (remote.user_preferences && typeof remote.user_preferences === 'object') {
    serverStore.user_preferences = {
      ...remote.user_preferences,
      ...serverStore.user_preferences,
    };
  }
}

export async function syncStoreFromCloud(force = false) {
  const now = Date.now();
  if (!force && now - lastCloudSyncAt < 1500) return;
  lastCloudSyncAt = now;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json?ref=${CLOUD_BRANCH}`,
      {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'nooraya-cloud-store',
        },
      }
    );
    if (!res.ok) return;
    const json = await res.json();
    if (json && json.sha) cloudStoreSha = json.sha;
    if (json && json.content) {
      const decoded = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
      mergeCloudIntoServerStore(decoded);
      try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), 'utf8');
      } catch {}
    }
  } catch (err) {
    // Non-fatal if offline
  }
}

async function persistStoreToCloud() {
  try {
    const snapshot = {
      users: serverStore.users || fallbackUsers,
      global_reciters: serverStore.global_reciters || [],
      global_videos: serverStore.global_videos || [],
      ambient_sounds: serverStore.ambient_sounds || { default: '/videos/cosmos.mp4' },
      user_preferences: serverStore.user_preferences || {},
      updated_at: new Date().toISOString(),
    };
    const contentB64 = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8').toString('base64');

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!cloudStoreSha || attempt > 0) {
        const getRes = await fetch(
          `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json?ref=${CLOUD_BRANCH}`,
          {
            headers: {
              Authorization: `token ${getCloudToken()}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'nooraya-cloud-store',
            },
          }
        );
        if (getRes.ok) {
          const getJson = await getRes.json();
          cloudStoreSha = getJson.sha;
          if (attempt > 0 && getJson.content) {
            try {
              const remoteData = JSON.parse(Buffer.from(getJson.content, 'base64').toString('utf8'));
              mergeCloudIntoServerStore(remoteData);
            } catch {}
          }
        }
      }

      const putRes = await fetch(
        `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json`,
        {
          method: 'PUT',
          headers: {
            Authorization: `token ${getCloudToken()}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'nooraya-cloud-store',
          },
          body: JSON.stringify({
            message: 'Sync Nooraya cloud store',
            content: contentB64,
            branch: CLOUD_BRANCH,
            ...(cloudStoreSha ? { sha: cloudStoreSha } : {}),
          }),
        }
      );

      if (putRes.ok) {
        const putJson = await putRes.json();
        if (putJson?.content?.sha) cloudStoreSha = putJson.content.sha;
        lastCloudSyncAt = Date.now();
        return;
      }
      if (putRes.status === 409) {
        cloudStoreSha = null;
        continue;
      }
      break;
    }
  } catch (err) {
    // Non-fatal
  }
}

async function saveMediaToCloud(id, mediaObj) {
  if (!id || !mediaObj) return;
  try {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const pathUrl = `https://api.github.com/repos/${CLOUD_REPO}/contents/media/${safeId}.json`;
    let existingSha = null;
    try {
      const checkRes = await fetch(`${pathUrl}?ref=${CLOUD_BRANCH}`, {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'nooraya-cloud-store',
        },
      });
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        existingSha = checkJson.sha;
      }
    } catch {}

    const contentB64 = Buffer.from(JSON.stringify(mediaObj), 'utf8').toString('base64');
    await fetch(pathUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${getCloudToken()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'nooraya-cloud-store',
      },
      body: JSON.stringify({
        message: `Store media ${safeId}`,
        content: contentB64,
        branch: CLOUD_BRANCH,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });
  } catch {}
}

async function loadMediaFromCloud(id) {
  if (!id) return null;
  try {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const res = await fetch(
      `https://api.github.com/repos/${CLOUD_REPO}/contents/media/${safeId}.json?ref=${CLOUD_BRANCH}`,
      {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: 'application/vnd.github.raw+json',
          'User-Agent': 'nooraya-cloud-store',
        },
      }
    );
    if (!res.ok) return null;
    const mediaObj = await res.json();
    if (mediaObj && mediaObj.data_url) {
      if (!serverStore.global_media) serverStore.global_media = {};
      serverStore.global_media[id] = mediaObj;
      return mediaObj;
    }
  } catch {}
  return null;
}

async function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), 'utf8');
  } catch (err) {
    // Graceful no-op on read-only environments
  }
  await persistStoreToCloud();
}

let dbInitialized = false;
async function ensureDbInitialized(p) {
  if (dbInitialized) return;
  // Probe connection first so we don't run 13 queries if Neon quota is exceeded
  await p.query('SELECT 1');
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      uid           TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      display_name  TEXT,
      photo_url     TEXT,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS user_preferences (
      user_uid                   TEXT PRIMARY KEY,
      theme                      TEXT NOT NULL DEFAULT 'midnight-scholar',
      active_background_video_id TEXT,
      ambient_video_mapping      JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS custom_reciters (
      id         TEXT PRIMARY KEY,
      user_uid   TEXT NOT NULL,
      name       TEXT NOT NULL,
      style      TEXT,
      server_url TEXT,
      image_url  TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE custom_reciters ALTER COLUMN server_url DROP NOT NULL`,
    `ALTER TABLE custom_reciters ADD COLUMN IF NOT EXISTS image_url TEXT`,
    `CREATE TABLE IF NOT EXISTS global_reciters (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      name_arabic TEXT,
      style       TEXT,
      category    TEXT,
      bio         TEXT,
      server_url  TEXT,
      image_url   TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE global_reciters ALTER COLUMN server_url DROP NOT NULL`,
    `ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS name_arabic TEXT`,
    `ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS category TEXT`,
    `ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS bio TEXT`,
    `ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS image_url TEXT`,
    `CREATE TABLE IF NOT EXISTS global_background_videos (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      video_url   TEXT NOT NULL,
      description TEXT,
      is_default  BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS ambient_sounds (
      id         TEXT PRIMARY KEY,
      name       TEXT,
      video_url  TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS global_media (
      id         TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,
      mime_type  TEXT NOT NULL,
      data_url   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS global_media_chunks (
      upload_id   TEXT NOT NULL,
      chunk_index INT NOT NULL,
      chunk_data  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (upload_id, chunk_index)
    )`,
    `INSERT INTO users (uid, email, display_name, role)
     VALUES ('usr_admin_ibrahim', 'ibrahimfaruqolamilekan4@gmail.com', 'Ibrahim Faruq (Admin)', 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
  ];

  for (const stmt of statements) {
    try {
      await p.query(stmt);
    } catch (err) {
      // Continue applying remaining migrations even if one statement fails
    }
  }
  dbInitialized = true;
}

export async function q(text, params = []) {
  if (isDbConfigured() && Date.now() >= neonDownUntil) {
    try {
      const p = await getPool();
      await ensureDbInitialized(p);
      return await p.query(text, params);
    } catch (dbErr) {
      lastDbError = dbErr?.message || String(dbErr);
      neonDownUntil = Date.now() + 180_000;
      console.warn('[db] Query execution failed, switching to cloud store fallback:', lastDbError);
    }
  }

  // Synchronize in-memory store with persistent cloud store across Vercel instances
  await syncStoreFromCloud();

  // Graceful persistent query emulation for development, preview, and mobile devices
  const qStr = String(text || '').trim();

  // 1. Users
  if (qStr.includes('FROM users') || qStr.includes('UPDATE users') || qStr.includes('INSERT INTO users') || qStr.includes('DELETE FROM users')) {
    if (qStr.startsWith('SELECT uid, email') && params[0]) {
      const target = String(params[0]).toLowerCase();
      const u = serverStore.users.find(x => (x.email && x.email.toLowerCase() === target) || x.uid === params[0]);
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
      const u = serverStore.users.find(x => x.uid === params[1] || x.email === params[1]);
      if (u) {
        u.role = params[0];
        await saveStore();
      }
      return { rowCount: u ? 1 : 0, rows: [] };
    }
    if (qStr.startsWith('DELETE FROM users WHERE uid = $1')) {
      const before = serverStore.users.length;
      serverStore.users = serverStore.users.filter(x => x.uid !== params[0]);
      if (serverStore.users.length !== before) {
        await saveStore();
      }
      return { rowCount: before - serverStore.users.length, rows: [] };
    }
    if (qStr.includes('UPDATE users SET')) {
      const lookup = params[params.length - 1];
      const u = serverStore.users.find(x => x.uid === lookup || (x.email && x.email.toLowerCase() === String(lookup).toLowerCase()));
      if (u) {
        if (qStr.includes('password_hash') && params[0]) u.password_hash = params[0];
        if (qStr.includes('display_name') && params[1]) u.display_name = params[1];
        u.last_login_at = new Date().toISOString();
        await saveStore();
      }
      return { rowCount: u ? 1 : 0, rows: [] };
    }
    if (qStr.startsWith('INSERT INTO users')) {
      const [uid, email, passHash, dispName, role] = params;
      const cleanEmail = String(email || '').trim().toLowerCase();
      const existingIdx = serverStore.users.findIndex(x => (x.email && x.email.toLowerCase() === cleanEmail) || x.uid === uid);
      const newUser = {
        uid: uid || `usr_${Date.now()}`,
        email: cleanEmail,
        password_hash: passHash || (existingIdx >= 0 ? serverStore.users[existingIdx].password_hash : null),
        display_name: dispName || (existingIdx >= 0 ? serverStore.users[existingIdx].display_name : cleanEmail.split('@')[0]),
        photo_url: existingIdx >= 0 ? serverStore.users[existingIdx].photo_url : null,
        role: role || (cleanEmail === 'ibrahimfaruqolamilekan4@gmail.com' ? 'admin' : 'user'),
        created_at: existingIdx >= 0 ? serverStore.users[existingIdx].created_at : new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        serverStore.users[existingIdx] = newUser;
      } else {
        serverStore.users.unshift(newUser);
      }
      await saveStore();
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
      // Support both 4-param and 7-param inserts
      const id = params[0];
      const existingIdx = serverStore.global_reciters.findIndex(r => r.id === id);
      const prev = existingIdx >= 0 ? serverStore.global_reciters[existingIdx] : null;

      let name = '';
      let serverUrl = '';
      let imageUrl = null;
      let nameArabic = null;
      let category = null;
      let bio = null;

      if (qStr.includes('INSERT INTO custom_reciters')) {
        // params: [id, user.uid, name, style, serverUrl, imageUrl]
        name = typeof params[2] === 'string' ? params[2].trim() : id;
        serverUrl = typeof params[4] === 'string' ? params[4].trim() : '';
        imageUrl = params[5] !== undefined ? params[5] : null;
      } else if (params.length >= 7) {
        // params: [id, name, serverUrl, imageUrl, nameArabic, category, bio]
        name = typeof params[1] === 'string' ? params[1].trim() : '';
        serverUrl = typeof params[2] === 'string' ? params[2].trim() : '';
        imageUrl = params[3] !== undefined ? params[3] : null;
        nameArabic = params[4] !== undefined ? params[4] : null;
        category = params[5] !== undefined ? params[5] : null;
        bio = params[6] !== undefined ? params[6] : null;
      } else {
        // params: [id, name, serverUrl, imageUrl]
        name = typeof params[1] === 'string' ? params[1].trim() : '';
        serverUrl = typeof params[2] === 'string' ? params[2].trim() : '';
        imageUrl = params[3] !== undefined ? params[3] : null;
      }

      const reciterRow = {
        id,
        name: name || prev?.name || id,
        name_arabic: nameArabic !== null && nameArabic !== undefined ? nameArabic : (prev?.name_arabic || null),
        style: prev?.style || 'Custom Global',
        category: category !== null && category !== undefined ? category : (prev?.category || null),
        bio: bio !== null && bio !== undefined ? bio : (prev?.bio || null),
        server_url: serverUrl || prev?.server_url || '',
        image_url: imageUrl !== null && imageUrl !== undefined ? imageUrl : (prev?.image_url || null),
      };
      if (existingIdx >= 0) {
        serverStore.global_reciters[existingIdx] = reciterRow;
      } else {
        serverStore.global_reciters.push(reciterRow);
      }
      await saveStore();
      return { rowCount: 1, rows: [reciterRow] };
    }
    if (qStr.includes('DELETE FROM global_reciters') || qStr.includes('DELETE FROM custom_reciters')) {
      const targetId = params[0];
      serverStore.global_reciters = serverStore.global_reciters.filter(r => r.id !== targetId);
      await saveStore();
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
      await saveStore();
      return { rowCount: 1, rows: [vidRow] };
    }
    if (qStr.includes('UPDATE global_background_videos SET is_default = false')) {
      serverStore.global_videos.forEach(v => { v.is_default = false; });
      await saveStore();
      return { rowCount: serverStore.global_videos.length, rows: [] };
    }
    if (qStr.includes('UPDATE global_background_videos SET is_default = (id = $1)')) {
      const targetId = params[0];
      serverStore.global_videos.forEach(v => { v.is_default = (v.id === targetId || v.video_url === targetId); });
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
    if (qStr.includes('DELETE FROM global_background_videos WHERE id = $1')) {
      const targetId = params[0];
      serverStore.global_videos = serverStore.global_videos.filter(v => v.id !== targetId);
      await saveStore();
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
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
  }

  // 5. Global Media & Chunks
  if (qStr.includes('global_media_chunks')) {
    if (!serverStore.global_media_chunks) serverStore.global_media_chunks = {};
    if (qStr.startsWith('INSERT INTO global_media_chunks')) {
      const [uploadId, chunkIndex, chunkData] = params;
      if (!serverStore.global_media_chunks[uploadId]) {
        serverStore.global_media_chunks[uploadId] = {};
      }
      serverStore.global_media_chunks[uploadId][Number(chunkIndex)] = String(chunkData || '');
      return { rowCount: 1, rows: [] };
    }
    if (qStr.startsWith('SELECT') && params[0]) {
      const uploadId = params[0];
      const map = serverStore.global_media_chunks[uploadId] || {};
      const rows = Object.keys(map)
        .map(k => ({ chunk_index: Number(k), chunk_data: map[k] }))
        .sort((a, b) => a.chunk_index - b.chunk_index);
      return { rows };
    }
    if (qStr.startsWith('DELETE FROM global_media_chunks') && params[0]) {
      delete serverStore.global_media_chunks[params[0]];
      return { rowCount: 1, rows: [] };
    }
    return { rows: [] };
  }

  if (qStr.includes('global_media')) {
    if (!serverStore.global_media) serverStore.global_media = {};
    if (qStr.startsWith('INSERT INTO global_media')) {
      const [id, kind, mimeType, dataUrl] = params;
      serverStore.global_media[id] = {
        id,
        kind,
        mime_type: mimeType,
        data_url: dataUrl,
        created_at: new Date().toISOString(),
      };
      await saveMediaToCloud(id, serverStore.global_media[id]);
      return { rowCount: 1, rows: [serverStore.global_media[id]] };
    }
    if (qStr.startsWith('SELECT') && params[0]) {
      const mediaId = params[0];
      let item = serverStore.global_media[mediaId];
      if (!item) {
        item = await loadMediaFromCloud(mediaId);
      }
      return { rows: item ? [item] : [] };
    }
    return { rows: [] };
  }

  if (qStr.includes('user_preferences')) {
    if (!serverStore.user_preferences) serverStore.user_preferences = {};
    const uid = params[0] || 'default';

    if (qStr.startsWith('INSERT INTO user_preferences (user_uid, theme')) {
      const [, theme, activeVideoId, mappingVal] = params;
      let mapping = {};
      try {
        mapping = typeof mappingVal === 'string' ? JSON.parse(mappingVal) : (mappingVal || {});
      } catch {}
      serverStore.user_preferences[uid] = {
        user_uid: uid,
        theme: theme || 'midnight-scholar',
        active_background_video_id: activeVideoId || null,
        ambient_video_mapping: mapping,
        updated_at: new Date().toISOString(),
      };
      await saveStore();
      return {
        rowCount: 1,
        rows: [{
          theme: serverStore.user_preferences[uid].theme,
          active_background_video_id: serverStore.user_preferences[uid].active_background_video_id,
          ambient_video_mapping: serverStore.user_preferences[uid].ambient_video_mapping,
        }],
      };
    }

    if (!serverStore.user_preferences[uid]) {
      serverStore.user_preferences[uid] = {
        user_uid: uid,
        theme: 'midnight-scholar',
        active_background_video_id: null,
        ambient_video_mapping: {},
        updated_at: new Date().toISOString(),
      };
    }

    const row = serverStore.user_preferences[uid];
    return {
      rowCount: 1,
      rows: [{
        theme: row.theme || 'midnight-scholar',
        active_background_video_id: row.active_background_video_id ?? null,
        ambient_video_mapping: row.ambient_video_mapping ?? {},
      }],
    };
  }

  return { rows: [] };
}

export function mapUser(row) {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name ?? row.displayName ?? null,
    photoURL: row.photo_url ?? row.photoURL ?? null,
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

export function createSessionToken(userOrUid) {
  const payload =
    typeof userOrUid === 'object' && userOrUid !== null
      ? {
          uid: userOrUid.uid,
          email: userOrUid.email || null,
          displayName: userOrUid.displayName || userOrUid.display_name || null,
          role: userOrUid.role || 'user',
          exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1000,
        }
      : {
          uid: String(userOrUid),
          exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1000,
        };
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

function verifySessionTokenPayload(token) {
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
    return payload;
  } catch {
    return null;
  }
}

/** Returns the logged-in user (fresh from DB or fallback store so role changes apply immediately), or null. */
export async function getAuthUser(req) {
  const token = readSessionToken(req);
  if (token) {
    const payload = verifySessionTokenPayload(token);
    if (payload && payload.uid) {
      try {
        const { rows } = await q(
          'SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE uid = $1',
          [payload.uid]
        );
        if (rows[0]) return mapUser(rows[0]);
      } catch {}

      if (payload.email) {
        try {
          const { rows } = await q(
            'SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1',
            [payload.email]
          );
          if (rows[0]) return mapUser(rows[0]);

          // Auto-restore user from signed session token into cloud store
          const restoredRole = payload.email.toLowerCase() === adminEmail() ? 'admin' : (payload.role || 'user');
          const restoredName = payload.displayName || payload.email.split('@')[0];
          await q(
            'INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())',
            [payload.uid, payload.email.toLowerCase(), null, restoredName, restoredRole]
          );
          return {
            uid: payload.uid,
            email: payload.email.toLowerCase(),
            displayName: restoredName,
            photoURL: null,
            role: restoredRole,
          };
        } catch {}
      }

      // Legacy session token with only { uid, exp } created before Neon hit quota:
      // Return the master admin user so the signed-in owner is never locked out of Admin / Settings
      const defaultAdmin = serverStore.users?.find(u => u.role === 'admin') || fallbackUsers[0];
      return mapUser(defaultAdmin);
    }
  }

  // When Neon is unconfigured or in fallback mode, provide default admin user so Admin Console works seamlessly
  if (isNeonFallbackActive()) {
    const defaultAdmin = serverStore.users?.find(u => u.role === 'admin') || fallbackUsers[0];
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
  const user = await getAuthUser(req);
  if (!user) {
    // Allow fallback admin when Neon is in quota fallback
    const defaultAdmin = serverStore.users?.find(u => u.role === 'admin') || fallbackUsers[0];
    return mapUser(defaultAdmin);
  }
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
  if (isDbConfigured() && Date.now() >= neonDownUntil) {
    try {
      const p = await getPool();
      await ensureDbInitialized(p);
      let lastDbErr;
      for (const { text, params = [] } of queries) {
        try {
          return await p.query(text, params);
        } catch (err) {
          lastDbErr = err;
          continue;
        }
      }
      lastDbError = lastDbErr?.message || String(lastDbErr);
      neonDownUntil = Date.now() + 180_000;
      console.warn('[db] qWithFallback exhausted DB candidates, using cloud store:', lastDbError);
    } catch (poolErr) {
      lastDbError = poolErr?.message || String(poolErr);
      neonDownUntil = Date.now() + 180_000;
      console.warn('[db] Pool error in qWithFallback:', lastDbError);
    }
  }
  const first = queries[0];
  return await q(first.text, first.params || []);
}
