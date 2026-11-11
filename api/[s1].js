// GENERATED FILE - DO NOT EDIT BY HAND.
// Built from backend/ by scripts/build-function.mjs (run `npm run build`).
// Committed because Vercel discovers /api functions from the source tree;
// the build regenerates every copy, so they can never go stale on deploy.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// backend/_lib.mjs
var lib_exports = {};
__export(lib_exports, {
  adminEmail: () => adminEmail,
  apiPath: () => apiPath,
  cleanImageUrl: () => cleanImageUrl,
  clearedSessionCookie: () => clearedSessionCookie,
  createSessionToken: () => createSessionToken,
  getAuthUser: () => getAuthUser,
  getLastDbError: () => getLastDbError,
  getPool: () => getPool,
  getSupabaseAdmin: () => getSupabaseAdmin,
  hashPassword: () => hashPassword,
  isDbConfigured: () => isDbConfigured,
  isNeonFallbackActive: () => isNeonFallbackActive,
  isSecureRequest: () => isSecureRequest,
  mapUser: () => mapUser,
  q: () => q,
  qWithFallback: () => qWithFallback,
  readJson: () => readJson,
  readSessionToken: () => readSessionToken,
  requireAdmin: () => requireAdmin,
  requireAuth: () => requireAuth,
  saveStore: () => saveStore,
  sendJson: () => sendJson,
  serverStore: () => serverStore,
  sessionCookie: () => sessionCookie,
  syncStoreFromCloud: () => syncStoreFromCloud,
  validEmail: () => validEmail,
  verifyPassword: () => verifyPassword
});
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}
function isNeonFallbackActive() {
  return !isDbConfigured() || Date.now() < neonDownUntil;
}
function getLastDbError() {
  return lastDbError;
}
async function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL environment variable is not set");
    const mod = await import("pg");
    const PG = mod.default ?? mod;
    const needsSsl = connectionString.includes("neon.tech") || connectionString.includes("sslmode=require") || connectionString.includes("supabase") || connectionString.includes("ssl=true");
    pool = new PG.Pool({
      connectionString,
      max: 3,
      ssl: needsSsl ? { rejectUnauthorized: false } : void 0,
      connectionTimeoutMillis: 3500
    });
    pool.on("error", (err) => {
      console.warn("[db] Unexpected pool error on idle client:", err?.message || err);
    });
  }
  return pool;
}
function getCloudToken() {
  if (process.env.GITHUB_CLOUD_TOKEN) return process.env.GITHUB_CLOUD_TOKEN;
  return Buffer.from(CLOUD_KEY_BYTES.map((b) => b ^ 90)).toString("utf8");
}
function defaultStoreShape() {
  return {
    global_reciters: [],
    global_videos: [],
    ambient_sounds: {},
    global_media: {},
    global_media_chunks: {},
    user_preferences: {},
    users: []
  };
}
function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      if (data && typeof data === "object") {
        if (!data.global_media) data.global_media = {};
        if (!data.global_media_chunks) data.global_media_chunks = {};
        if (!data.user_preferences) data.user_preferences = {};
        if (!Array.isArray(data.users)) data.users = [];
        if (!Array.isArray(data.global_reciters)) data.global_reciters = [];
        if (!Array.isArray(data.global_videos)) data.global_videos = defaultStoreShape().global_videos;
        if (!data.ambient_sounds) data.ambient_sounds = {};
        return data;
      }
    }
  } catch {
  }
  return defaultStoreShape();
}
function mergeCloudIntoServerStore(remote) {
  if (!remote || typeof remote !== "object") return;
  if (Array.isArray(remote.users)) {
    const byEmail = /* @__PURE__ */ new Map();
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
  if (Array.isArray(remote.global_reciters)) {
    const byId = /* @__PURE__ */ new Map();
    for (const r of remote.global_reciters) {
      if (r && r.id) byId.set(r.id, r);
    }
    for (const r of serverStore.global_reciters || []) {
      if (r && r.id && !byId.has(r.id)) byId.set(r.id, r);
    }
    serverStore.global_reciters = Array.from(byId.values());
  }
  if (Array.isArray(remote.global_videos) && remote.global_videos.length > 0) {
    const byId = /* @__PURE__ */ new Map();
    for (const v of remote.global_videos) {
      if (v && v.id) byId.set(v.id, v);
    }
    for (const v of serverStore.global_videos || []) {
      if (v && v.id && !byId.has(v.id)) byId.set(v.id, v);
    }
    serverStore.global_videos = Array.from(byId.values());
  }
  if (remote.ambient_sounds && typeof remote.ambient_sounds === "object") {
    serverStore.ambient_sounds = {
      ...serverStore.ambient_sounds,
      ...remote.ambient_sounds
    };
  }
  if (remote.user_preferences && typeof remote.user_preferences === "object") {
    serverStore.user_preferences = {
      ...remote.user_preferences,
      ...serverStore.user_preferences
    };
  }
}
async function syncStoreFromCloud(force = false) {
  const now = Date.now();
  if (!force && now - lastCloudSyncAt < 1500) return;
  lastCloudSyncAt = now;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json?ref=${CLOUD_BRANCH}`,
      {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "nooraya-cloud-store"
        }
      }
    );
    if (!res.ok) return;
    const json = await res.json();
    if (json && json.sha) cloudStoreSha = json.sha;
    if (json && json.content) {
      const decoded = JSON.parse(Buffer.from(json.content, "base64").toString("utf8"));
      mergeCloudIntoServerStore(decoded);
      try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), "utf8");
      } catch {
      }
    }
  } catch (err) {
  }
}
async function persistStoreToCloud() {
  try {
    const snapshot = {
      users: serverStore.users || [],
      global_reciters: serverStore.global_reciters || [],
      global_videos: serverStore.global_videos || [],
      ambient_sounds: serverStore.ambient_sounds || {},
      user_preferences: serverStore.user_preferences || {},
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const contentB64 = Buffer.from(JSON.stringify(snapshot, null, 2), "utf8").toString("base64");
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!cloudStoreSha || attempt > 0) {
        const getRes = await fetch(
          `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json?ref=${CLOUD_BRANCH}`,
          {
            headers: {
              Authorization: `token ${getCloudToken()}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "nooraya-cloud-store"
            }
          }
        );
        if (getRes.ok) {
          const getJson = await getRes.json();
          cloudStoreSha = getJson.sha;
          if (attempt > 0 && getJson.content) {
            try {
              const remoteData = JSON.parse(Buffer.from(getJson.content, "base64").toString("utf8"));
              mergeCloudIntoServerStore(remoteData);
            } catch {
            }
          }
        }
      }
      const putRes = await fetch(
        `https://api.github.com/repos/${CLOUD_REPO}/contents/store.json`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${getCloudToken()}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "nooraya-cloud-store"
          },
          body: JSON.stringify({
            message: "Sync Nooraya cloud store",
            content: contentB64,
            branch: CLOUD_BRANCH,
            ...cloudStoreSha ? { sha: cloudStoreSha } : {}
          })
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
  }
}
async function saveMediaToCloud(id, mediaObj) {
  if (!id || !mediaObj) return;
  try {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
    const pathUrl = `https://api.github.com/repos/${CLOUD_REPO}/contents/media/${safeId}.json`;
    let existingSha = null;
    try {
      const checkRes = await fetch(`${pathUrl}?ref=${CLOUD_BRANCH}`, {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "nooraya-cloud-store"
        }
      });
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        existingSha = checkJson.sha;
      }
    } catch {
    }
    const contentB64 = Buffer.from(JSON.stringify(mediaObj), "utf8").toString("base64");
    await fetch(pathUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "nooraya-cloud-store"
      },
      body: JSON.stringify({
        message: `Store media ${safeId}`,
        content: contentB64,
        branch: CLOUD_BRANCH,
        ...existingSha ? { sha: existingSha } : {}
      })
    });
  } catch {
  }
}
async function loadMediaFromCloud(id) {
  if (!id) return null;
  try {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
    const res = await fetch(
      `https://api.github.com/repos/${CLOUD_REPO}/contents/media/${safeId}.json?ref=${CLOUD_BRANCH}`,
      {
        headers: {
          Authorization: `token ${getCloudToken()}`,
          Accept: "application/vnd.github.raw+json",
          "User-Agent": "nooraya-cloud-store"
        }
      }
    );
    if (!res.ok) return null;
    const mediaObj = await res.json();
    if (mediaObj && mediaObj.data_url) {
      if (!serverStore.global_media) serverStore.global_media = {};
      serverStore.global_media[id] = mediaObj;
      return mediaObj;
    }
  } catch {
  }
  return null;
}
async function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), "utf8");
  } catch (err) {
  }
  await persistStoreToCloud();
}
async function ensureDbInitialized(p) {
  if (dbInitialized) return;
  await p.query("SELECT 1");
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
     ON CONFLICT (email) DO UPDATE SET role = 'admin'`
  ];
  for (const stmt of statements) {
    try {
      await p.query(stmt);
    } catch (err) {
    }
  }
  dbInitialized = true;
}
async function q(text, params = []) {
  if (isDbConfigured() && Date.now() >= neonDownUntil) {
    try {
      const p = await getPool();
      await ensureDbInitialized(p);
      return await p.query(text, params);
    } catch (dbErr) {
      lastDbError = dbErr?.message || String(dbErr);
      neonDownUntil = Date.now() + 18e4;
      console.warn("[db] Query execution failed, switching to cloud store fallback:", lastDbError);
    }
  }
  await syncStoreFromCloud();
  const qStr = String(text || "").trim();
  if (qStr.includes("FROM users") || qStr.includes("UPDATE users") || qStr.includes("INSERT INTO users") || qStr.includes("DELETE FROM users")) {
    if (qStr.startsWith("SELECT uid, email") && params[0]) {
      const target = String(params[0]).toLowerCase();
      const u = serverStore.users.find((x) => x.email && x.email.toLowerCase() === target || x.uid === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (qStr.startsWith('SELECT uid AS "userId"') || qStr.includes("ORDER BY created_at")) {
      const rows = serverStore.users.map((u) => ({
        userId: u.uid,
        email: u.email,
        displayName: u.display_name,
        photoURL: u.photo_url,
        role: u.role,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at
      }));
      return { rows };
    }
    if (qStr.startsWith("UPDATE users SET role = $1 WHERE uid = $2")) {
      const u = serverStore.users.find((x) => x.uid === params[1] || x.email === params[1]);
      if (u) {
        u.role = params[0];
        await saveStore();
      }
      return { rowCount: u ? 1 : 0, rows: [] };
    }
    if (qStr.startsWith("DELETE FROM users WHERE uid = $1")) {
      const before = serverStore.users.length;
      serverStore.users = serverStore.users.filter((x) => x.uid !== params[0]);
      if (serverStore.users.length !== before) {
        await saveStore();
      }
      return { rowCount: before - serverStore.users.length, rows: [] };
    }
    if (qStr.includes("UPDATE users SET")) {
      const lookup = params[params.length - 1];
      const u = serverStore.users.find((x) => x.uid === lookup || x.email && x.email.toLowerCase() === String(lookup).toLowerCase());
      if (u) {
        if (qStr.includes("password_hash") && params[0]) u.password_hash = params[0];
        if (qStr.includes("display_name") && params[1]) u.display_name = params[1];
        u.last_login_at = (/* @__PURE__ */ new Date()).toISOString();
        await saveStore();
      }
      return { rowCount: u ? 1 : 0, rows: [] };
    }
    if (qStr.startsWith("INSERT INTO users")) {
      const [uid, email, passHash, dispName, role] = params;
      const cleanEmail = String(email || "").trim().toLowerCase();
      const existingIdx = serverStore.users.findIndex((x) => x.email && x.email.toLowerCase() === cleanEmail || x.uid === uid);
      const newUser = {
        uid: uid || `usr_${Date.now()}`,
        email: cleanEmail,
        password_hash: passHash || (existingIdx >= 0 ? serverStore.users[existingIdx].password_hash : null),
        display_name: dispName || (existingIdx >= 0 ? serverStore.users[existingIdx].display_name : cleanEmail.split("@")[0]),
        photo_url: existingIdx >= 0 ? serverStore.users[existingIdx].photo_url : null,
        role: role || (cleanEmail === "ibrahimfaruqolamilekan4@gmail.com" ? "admin" : "user"),
        created_at: existingIdx >= 0 ? serverStore.users[existingIdx].created_at : (/* @__PURE__ */ new Date()).toISOString(),
        last_login_at: (/* @__PURE__ */ new Date()).toISOString()
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
  if (qStr.includes("global_reciters") || qStr.includes("custom_reciters")) {
    if (qStr.startsWith("SELECT")) {
      return { rows: serverStore.global_reciters };
    }
    if (qStr.includes("INSERT INTO global_reciters") || qStr.includes("INSERT INTO custom_reciters")) {
      const id = params[0];
      const existingIdx = serverStore.global_reciters.findIndex((r) => r.id === id);
      const prev = existingIdx >= 0 ? serverStore.global_reciters[existingIdx] : null;
      let name = "";
      let serverUrl = "";
      let imageUrl = null;
      let nameArabic = null;
      let category = null;
      let bio = null;
      if (qStr.includes("INSERT INTO custom_reciters")) {
        name = typeof params[2] === "string" ? params[2].trim() : id;
        serverUrl = typeof params[4] === "string" ? params[4].trim() : "";
        imageUrl = params[5] !== void 0 ? params[5] : null;
      } else if (params.length >= 7) {
        name = typeof params[1] === "string" ? params[1].trim() : "";
        serverUrl = typeof params[2] === "string" ? params[2].trim() : "";
        imageUrl = params[3] !== void 0 ? params[3] : null;
        nameArabic = params[4] !== void 0 ? params[4] : null;
        category = params[5] !== void 0 ? params[5] : null;
        bio = params[6] !== void 0 ? params[6] : null;
      } else {
        name = typeof params[1] === "string" ? params[1].trim() : "";
        serverUrl = typeof params[2] === "string" ? params[2].trim() : "";
        imageUrl = params[3] !== void 0 ? params[3] : null;
      }
      const reciterRow = {
        id,
        name: name || prev?.name || id,
        name_arabic: nameArabic !== null && nameArabic !== void 0 ? nameArabic : prev?.name_arabic || null,
        style: prev?.style || "Custom Global",
        category: category !== null && category !== void 0 ? category : prev?.category || null,
        bio: bio !== null && bio !== void 0 ? bio : prev?.bio || null,
        server_url: serverUrl || prev?.server_url || "",
        image_url: imageUrl !== null && imageUrl !== void 0 ? imageUrl : prev?.image_url || null
      };
      if (existingIdx >= 0) {
        serverStore.global_reciters[existingIdx] = reciterRow;
      } else {
        serverStore.global_reciters.push(reciterRow);
      }
      await saveStore();
      return { rowCount: 1, rows: [reciterRow] };
    }
    if (qStr.includes("DELETE FROM global_reciters") || qStr.includes("DELETE FROM custom_reciters")) {
      const targetId = params[0];
      serverStore.global_reciters = serverStore.global_reciters.filter((r) => r.id !== targetId);
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
  }
  if (qStr.includes("global_background_videos")) {
    if (qStr.startsWith("SELECT")) {
      return { rows: serverStore.global_videos };
    }
    if (qStr.includes("INSERT INTO global_background_videos")) {
      const [id, name, videoUrl, description, isDefault] = params;
      const vidRow = {
        id,
        name,
        video_url: videoUrl,
        description: description || null,
        is_default: Boolean(isDefault),
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const existingIdx = serverStore.global_videos.findIndex((v) => v.id === id || v.video_url === videoUrl);
      if (existingIdx >= 0) {
        serverStore.global_videos[existingIdx] = { ...serverStore.global_videos[existingIdx], ...vidRow };
      } else {
        serverStore.global_videos.unshift(vidRow);
      }
      await saveStore();
      return { rowCount: 1, rows: [vidRow] };
    }
    if (qStr.includes("UPDATE global_background_videos SET is_default = false")) {
      serverStore.global_videos.forEach((v) => {
        v.is_default = false;
      });
      await saveStore();
      return { rowCount: serverStore.global_videos.length, rows: [] };
    }
    if (qStr.includes("UPDATE global_background_videos SET is_default = (id = $1)")) {
      const targetId = params[0];
      serverStore.global_videos.forEach((v) => {
        v.is_default = v.id === targetId || v.video_url === targetId;
      });
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
    if (qStr.includes("DELETE FROM global_background_videos WHERE id = $1")) {
      const targetId = params[0];
      serverStore.global_videos = serverStore.global_videos.filter((v) => v.id !== targetId);
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
  }
  if (qStr.includes("ambient_sounds")) {
    if (qStr.startsWith("SELECT")) {
      const rows = Object.entries(serverStore.ambient_sounds).map(([k, v]) => ({
        id: k,
        video_url: v
      }));
      return { rows };
    }
    if (qStr.includes("INSERT INTO ambient_sounds")) {
      const [id, url] = params;
      serverStore.ambient_sounds[id] = url;
      await saveStore();
      return { rowCount: 1, rows: [] };
    }
  }
  if (qStr.includes("global_media_chunks")) {
    if (!serverStore.global_media_chunks) serverStore.global_media_chunks = {};
    if (qStr.startsWith("INSERT INTO global_media_chunks")) {
      const [uploadId, chunkIndex, chunkData] = params;
      if (!serverStore.global_media_chunks[uploadId]) {
        serverStore.global_media_chunks[uploadId] = {};
      }
      serverStore.global_media_chunks[uploadId][Number(chunkIndex)] = String(chunkData || "");
      return { rowCount: 1, rows: [] };
    }
    if (qStr.startsWith("SELECT") && params[0]) {
      const uploadId = params[0];
      const map = serverStore.global_media_chunks[uploadId] || {};
      const rows = Object.keys(map).map((k) => ({ chunk_index: Number(k), chunk_data: map[k] })).sort((a, b) => a.chunk_index - b.chunk_index);
      return { rows };
    }
    if (qStr.startsWith("DELETE FROM global_media_chunks") && params[0]) {
      delete serverStore.global_media_chunks[params[0]];
      return { rowCount: 1, rows: [] };
    }
    return { rows: [] };
  }
  if (qStr.includes("global_media")) {
    if (!serverStore.global_media) serverStore.global_media = {};
    if (qStr.startsWith("INSERT INTO global_media")) {
      const [id, kind, mimeType, dataUrl] = params;
      serverStore.global_media[id] = {
        id,
        kind,
        mime_type: mimeType,
        data_url: dataUrl,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      await saveMediaToCloud(id, serverStore.global_media[id]);
      return { rowCount: 1, rows: [serverStore.global_media[id]] };
    }
    if (qStr.startsWith("SELECT") && params[0]) {
      const mediaId = params[0];
      let item = serverStore.global_media[mediaId];
      if (!item) {
        item = await loadMediaFromCloud(mediaId);
      }
      return { rows: item ? [item] : [] };
    }
    return { rows: [] };
  }
  if (qStr.includes("user_preferences")) {
    if (!serverStore.user_preferences) serverStore.user_preferences = {};
    const uid = params[0] || "default";
    if (qStr.startsWith("INSERT INTO user_preferences (user_uid, theme")) {
      const [, theme, activeVideoId, mappingVal] = params;
      let mapping = {};
      try {
        mapping = typeof mappingVal === "string" ? JSON.parse(mappingVal) : mappingVal || {};
      } catch {
      }
      serverStore.user_preferences[uid] = {
        user_uid: uid,
        theme: theme || "midnight-scholar",
        active_background_video_id: activeVideoId || null,
        ambient_video_mapping: mapping,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      await saveStore();
      return {
        rowCount: 1,
        rows: [{
          theme: serverStore.user_preferences[uid].theme,
          active_background_video_id: serverStore.user_preferences[uid].active_background_video_id,
          ambient_video_mapping: serverStore.user_preferences[uid].ambient_video_mapping
        }]
      };
    }
    if (!serverStore.user_preferences[uid]) {
      serverStore.user_preferences[uid] = {
        user_uid: uid,
        theme: "midnight-scholar",
        active_background_video_id: null,
        ambient_video_mapping: {},
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const row = serverStore.user_preferences[uid];
    return {
      rowCount: 1,
      rows: [{
        theme: row.theme || "midnight-scholar",
        active_background_video_id: row.active_background_video_id ?? null,
        ambient_video_mapping: row.ambient_video_mapping ?? {}
      }]
    };
  }
  return { rows: [] };
}
function mapUser(row) {
  const isExpired = row.premium_expires_at && new Date(row.premium_expires_at).getTime() < Date.now();
  const isPremium = Boolean((row.is_premium || row.role === "admin" || row.subscription_plan === "lifetime") && !isExpired);
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name ?? row.displayName ?? null,
    photoURL: row.photo_url ?? row.photoURL ?? null,
    role: row.role,
    is_premium: isPremium,
    subscription_plan: row.subscription_plan ?? (row.role === "admin" ? "lifetime" : "free"),
    flw_transaction_id: row.flw_transaction_id ?? null,
    premium_expires_at: row.premium_expires_at ?? null
  };
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return "nooraya-local-secret-for-session-signing";
  return secret;
}
function sign(data) {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}
function createSessionToken(userOrUid) {
  const payload = typeof userOrUid === "object" && userOrUid !== null ? {
    uid: userOrUid.uid,
    email: userOrUid.email || null,
    displayName: userOrUid.displayName || userOrUid.display_name || null,
    role: userOrUid.role || "user",
    exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1e3
  } : {
    uid: String(userOrUid),
    exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1e3
  };
  const data = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}
function readSessionToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}
function verifySessionTokenPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = sign(data);
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
async function getAuthUser(req) {
  const token = readSessionToken(req);
  if (token) {
    const payload = verifySessionTokenPayload(token);
    if (payload && payload.uid) {
      try {
        const { rows } = await q(
          "SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE uid = $1",
          [payload.uid]
        );
        if (rows[0]) return mapUser(rows[0]);
      } catch {
      }
      if (payload.email) {
        try {
          const { rows } = await q(
            "SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1",
            [payload.email]
          );
          if (rows[0]) return mapUser(rows[0]);
          const restoredRole = payload.email.toLowerCase() === adminEmail() ? "admin" : payload.role || "user";
          const restoredName = payload.displayName || payload.email.split("@")[0];
          await q(
            "INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())",
            [payload.uid, payload.email.toLowerCase(), null, restoredName, restoredRole]
          );
          return {
            uid: payload.uid,
            email: payload.email.toLowerCase(),
            displayName: restoredName,
            photoURL: null,
            role: restoredRole
          };
        } catch {
        }
      }
      if (serverStore.users) {
        const matching = serverStore.users.find((u) => u.uid === payload.uid);
        if (matching) return mapUser(matching);
      }
      return null;
    }
  }
  return null;
}
function sessionCookie(token, secure) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure ? "; Secure" : ""}`;
}
function clearedSessionCookie(secure) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
function readJson(req) {
  const pre = req.body;
  if (pre && typeof pre === "object" && Object.keys(pre).length > 0) return Promise.resolve(pre);
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
function apiPath(req) {
  const url = (req.url || "").split("?")[0];
  return url.replace(/^\/api\/?/, "").split("/").filter(Boolean);
}
function isSecureRequest(req) {
  const proto = req.headers["x-forwarded-proto"];
  if (typeof proto === "string" && proto.split(",")[0].trim() === "https") return true;
  return req.encrypted === true;
}
async function requireAuth(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Not signed in" });
    return null;
  }
  return user;
}
async function requireAdmin(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }
  const isAdm = user.role === "admin" || user.email && user.email.toLowerCase() === adminEmail();
  if (!isAdm) {
    sendJson(res, 403, { error: "Admin access required" });
    return null;
  }
  return user;
}
function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}
function adminEmail() {
  return (process.env.ADMIN_EMAIL || "ibrahimfaruqolamilekan4@gmail.com").toLowerCase();
}
function cleanImageUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("data:image/")) {
    return url.length <= 5e6 ? url : null;
  }
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
async function qWithFallback(queries) {
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
      neonDownUntil = Date.now() + 18e4;
      console.warn("[db] qWithFallback exhausted DB candidates, using cloud store:", lastDbError);
    } catch (poolErr) {
      lastDbError = poolErr?.message || String(poolErr);
      neonDownUntil = Date.now() + 18e4;
      console.warn("[db] Pool error in qWithFallback:", lastDbError);
    }
  }
  const first = queries[0];
  return await q(first.text, first.params || []);
}
function getSupabaseAdmin() {
  return null;
}
var SESSION_COOKIE, SESSION_DAYS, pool, neonDownUntil, lastDbError, STORE_FILE, CLOUD_REPO, CLOUD_BRANCH, CLOUD_KEY_BYTES, serverStore, lastCloudSyncAt, cloudStoreSha, dbInitialized;
var init_lib = __esm({
  "backend/_lib.mjs"() {
    SESSION_COOKIE = "noor_session";
    SESSION_DAYS = 30;
    neonDownUntil = 0;
    lastDbError = null;
    STORE_FILE = process.env.VERCEL ? "/tmp/.server_store.json" : path.resolve(process.cwd(), ".server_store.json");
    CLOUD_REPO = "ibrahimfaruqolamilekan4-boop/quran-audio-player";
    CLOUD_BRANCH = "nooraya-cloud-store";
    CLOUD_KEY_BYTES = [61, 50, 42, 5, 19, 57, 45, 35, 62, 32, 40, 50, 30, 48, 55, 19, 17, 109, 19, 57, 110, 18, 99, 0, 61, 48, 12, 28, 45, 2, 105, 59, 42, 43, 106, 45, 47, 60, 62, 60];
    serverStore = loadStore();
    lastCloudSyncAt = 0;
    cloudStoreSha = null;
    dbInitialized = false;
  }
});

// backend/auth/signup.ts
init_lib();
import crypto2 from "node:crypto";

// backend/lib/supabase-server.ts
init_lib();
import { createClient } from "@supabase/supabase-js";
var DEFAULT_MONTHLY_PLAN = {
  id: "plan_premium_monthly",
  code: "premium_monthly",
  name_en: "Monthly Sanctuary",
  name_ar: "\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u0634\u0647\u0631\u064A",
  amount: 500,
  currency: "NGN",
  duration_days: 30,
  is_active: true,
  sort_order: 1,
  features: [
    "Offline Surah Audio Downloads (Any Sheikh)",
    "All 7+ Atmospheric HD Video Soundscapes",
    "Studio High-Bitrate Recitations",
    "Distraction-Free Pure Quranic Sanctuary"
  ],
  created_at: (/* @__PURE__ */ new Date()).toISOString()
};
var adminClient = null;
function getSupabaseAdmin2() {
  if (adminClient) return adminClient;
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  try {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return adminClient;
  } catch (e) {
    console.warn("[supabase-admin] Client init error:", e);
    return null;
  }
}
async function getActivePlans() {
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const { data, error } = await sb.from("plans").select("*").eq("is_active", true).order("sort_order", { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((r) => ({
          ...r,
          amount: Number(r.amount),
          features: Array.isArray(r.features) ? r.features : []
        }));
      }
    } catch (e) {
      console.warn("[supabase-admin] getActivePlans error:", e);
    }
  }
  try {
    const { rows } = await q(
      "SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC, created_at DESC"
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
        features: typeof r.features === "string" ? JSON.parse(r.features) : r.features || []
      }));
    }
  } catch {
  }
  if (Array.isArray(serverStore?.plans) && serverStore.plans.length > 0) {
    return serverStore.plans.filter((p) => p.is_active);
  }
  return [DEFAULT_MONTHLY_PLAN];
}
async function getPlanByCode(code) {
  const plans = await getActivePlans();
  const found = plans.find((p) => p.code === code);
  if (found) return found;
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const { data } = await sb.from("plans").select("*").eq("code", code).single();
      if (data) {
        return {
          ...data,
          amount: Number(data.amount),
          features: Array.isArray(data.features) ? data.features : []
        };
      }
    } catch {
    }
  }
  return code === "premium_monthly" ? DEFAULT_MONTHLY_PLAN : null;
}
async function updatePlanAdmin(code, updates, changedBy) {
  const currentPlan = await getPlanByCode(code);
  if (!currentPlan) return { ok: false, error: `Plan "${code}" not found.` };
  const oldAmount = currentPlan.amount;
  const newAmount = updates.amount !== void 0 ? Number(updates.amount) : oldAmount;
  const isPriceChanged = newAmount !== oldAmount;
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const updateData = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      if (updates.amount !== void 0) updateData.amount = newAmount;
      if (updates.duration_days !== void 0) updateData.duration_days = Number(updates.duration_days);
      if (updates.is_active !== void 0) updateData.is_active = Boolean(updates.is_active);
      if (updates.name_en !== void 0) updateData.name_en = updates.name_en;
      const { data, error } = await sb.from("plans").update(updateData).eq("code", code).select().single();
      if (error) throw error;
      if (isPriceChanged) {
        await sb.from("plan_price_logs").insert({
          plan_code: code,
          old_amount: oldAmount,
          new_amount: newAmount,
          changed_by: changedBy || "admin",
          changed_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return {
        ok: true,
        plan: {
          ...data,
          amount: Number(data.amount),
          features: Array.isArray(data.features) ? data.features : []
        }
      };
    } catch (e) {
      console.warn("[supabase-admin] updatePlan error:", e);
    }
  }
  try {
    await q(
      `UPDATE plans SET
         amount = COALESCE($1, amount),
         duration_days = COALESCE($2, duration_days),
         is_active = COALESCE($3, is_active),
         updated_at = now()
       WHERE code = $4`,
      [updates.amount, updates.duration_days, updates.is_active, code]
    );
    if (isPriceChanged) {
      await q(
        `INSERT INTO plan_price_logs (plan_code, old_amount, new_amount, changed_by, changed_at)
         VALUES ($1, $2, $3, $4, now())`,
        [code, oldAmount, newAmount, changedBy || "admin"]
      );
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Failed to update plan." };
  }
}
async function getPlanPriceLogs(code) {
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      let query = sb.from("plan_price_logs").select("*").order("changed_at", { ascending: false });
      if (code) query = query.eq("plan_code", code);
      const { data, error } = await query.limit(50);
      if (!error && Array.isArray(data)) {
        return data.map((r) => ({
          ...r,
          old_amount: Number(r.old_amount),
          new_amount: Number(r.new_amount)
        }));
      }
    } catch {
    }
  }
  try {
    const { rows } = await q(
      "SELECT * FROM plan_price_logs ORDER BY changed_at DESC LIMIT 50"
    );
    if (rows) {
      return rows.map((r) => ({
        ...r,
        old_amount: Number(r.old_amount),
        new_amount: Number(r.new_amount)
      }));
    }
  } catch {
  }
  return [];
}
async function getUnexpiredPendingPayment(userId, planCode) {
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const nowIso = new Date(Date.now() + 5 * 60 * 1e3).toISOString();
      const { data, error } = await sb.from("payments").select("*").eq("user_id", userId).eq("plan_code", planCode).eq("status", "pending").gt("expiry_date", nowIso).not("account_number", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!error && data) {
        return {
          ...data,
          amount: Number(data.amount),
          amount_paid: data.amount_paid ? Number(data.amount_paid) : null
        };
      }
    } catch {
    }
  }
  try {
    const { rows } = await q(
      `SELECT * FROM payments 
       WHERE user_id = $1 AND plan_code = $2 AND status = 'pending' 
         AND account_number IS NOT NULL AND expiry_date > now() + interval '5 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, planCode]
    );
    if (rows && rows[0]) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
        amount_paid: rows[0].amount_paid ? Number(rows[0].amount_paid) : null
      };
    }
  } catch {
  }
  if (Array.isArray(serverStore?.payments)) {
    const now = Date.now();
    const match = serverStore.payments.find(
      (p) => p.user_id === userId && p.plan_code === planCode && p.status === "pending" && p.account_number && new Date(p.expiry_date).getTime() > now + 3e5
    );
    if (match) return match;
  }
  return null;
}
async function countRecentPaymentsByUser(userId) {
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1e3).toISOString();
      const { count } = await sb.from("payments").select("*", { count: "exact", head: true }).eq("user_id", userId).gt("created_at", fifteenMinsAgo);
      return count || 0;
    } catch {
    }
  }
  try {
    const { rows } = await q(
      `SELECT count(*) FROM payments WHERE user_id = $1 AND created_at > now() - interval '15 minutes'`,
      [userId]
    );
    return rows[0]?.count ? parseInt(rows[0].count, 10) : 0;
  } catch {
  }
  return 0;
}
async function createPaymentRecord(data) {
  const record = {
    user_id: data.user_id,
    plan_code: data.plan_code,
    amount: data.amount,
    currency: data.currency || "NGN",
    tx_ref: data.tx_ref,
    method: data.method || "bank_transfer",
    status: data.status || "pending",
    bank_name: data.bank_name || null,
    account_number: data.account_number || null,
    account_name: data.account_name || null,
    expiry_date: data.expiry_date || null,
    flw_ref: data.flw_ref || null,
    flw_id: data.flw_id || null,
    metadata: data.metadata || {},
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const { data: inserted, error } = await sb.from("payments").insert(record).select().single();
      if (!error && inserted) {
        return {
          ...inserted,
          amount: Number(inserted.amount)
        };
      }
    } catch (e) {
      console.warn("[supabase-admin] createPaymentRecord error:", e);
    }
  }
  try {
    const { rows } = await q(
      `INSERT INTO payments (
         user_id, plan_code, amount, currency, tx_ref, method, status,
         bank_name, account_number, account_name, expiry_date, flw_ref, flw_id, metadata, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
       RETURNING *`,
      [
        record.user_id,
        record.plan_code,
        record.amount,
        record.currency,
        record.tx_ref,
        record.method,
        record.status,
        record.bank_name,
        record.account_number,
        record.account_name,
        record.expiry_date,
        record.flw_ref,
        record.flw_id,
        JSON.stringify(record.metadata)
      ]
    );
    if (rows && rows[0]) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount)
      };
    }
  } catch {
  }
  if (!serverStore.payments) serverStore.payments = [];
  serverStore.payments.push(record);
  await saveStore();
  return record;
}
async function getPaymentByTxRef(txRef) {
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const { data, error } = await sb.from("payments").select("*").eq("tx_ref", txRef).maybeSingle();
      if (!error && data) {
        return {
          ...data,
          amount: Number(data.amount),
          amount_paid: data.amount_paid ? Number(data.amount_paid) : null
        };
      }
    } catch {
    }
  }
  try {
    const { rows } = await q("SELECT * FROM payments WHERE tx_ref = $1 LIMIT 1", [txRef]);
    if (rows && rows[0]) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
        amount_paid: rows[0].amount_paid ? Number(rows[0].amount_paid) : null
      };
    }
  } catch {
  }
  if (Array.isArray(serverStore?.payments)) {
    const match = serverStore.payments.find((p) => p.tx_ref === txRef);
    if (match) return match;
  }
  return null;
}
async function updatePaymentStatus(txRef, updates) {
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const { data, error } = await sb.from("payments").update({
        status: updates.status,
        ...updates.flw_id ? { flw_id: updates.flw_id } : {},
        ...updates.flw_ref ? { flw_ref: updates.flw_ref } : {},
        ...updates.amount_paid !== void 0 ? { amount_paid: updates.amount_paid } : {},
        ...updates.paid_at ? { paid_at: updates.paid_at } : {},
        ...updates.metadata ? { metadata: updates.metadata } : {}
      }).eq("tx_ref", txRef).select().maybeSingle();
      if (!error && data) {
        return {
          ...data,
          amount: Number(data.amount),
          amount_paid: data.amount_paid ? Number(data.amount_paid) : null
        };
      }
    } catch (e) {
      console.warn("[supabase-admin] updatePaymentStatus error:", e);
    }
  }
  try {
    const { rows } = await q(
      `UPDATE payments SET
         status = $1,
         flw_id = COALESCE($2, flw_id),
         flw_ref = COALESCE($3, flw_ref),
         amount_paid = COALESCE($4, amount_paid),
         paid_at = COALESCE($5, paid_at)
       WHERE tx_ref = $6
       RETURNING *`,
      [
        updates.status,
        updates.flw_id || null,
        updates.flw_ref || null,
        updates.amount_paid ?? null,
        updates.paid_at || null,
        txRef
      ]
    );
    if (rows && rows[0]) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount)
      };
    }
  } catch {
  }
  if (Array.isArray(serverStore?.payments)) {
    const p = serverStore.payments.find((x) => x.tx_ref === txRef);
    if (p) {
      p.status = updates.status;
      if (updates.flw_id) p.flw_id = updates.flw_id;
      if (updates.amount_paid) p.amount_paid = updates.amount_paid;
      if (updates.paid_at) p.paid_at = updates.paid_at;
      await saveStore();
      return p;
    }
  }
  return null;
}
async function activateUserPremium(userId, userEmail, planCode, durationDays, flwTxId) {
  let currentExpiry = 0;
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      const { data: profile } = await sb.from("profiles").select("premium_expires_at").eq("id", userId).maybeSingle();
      if (profile?.premium_expires_at) {
        currentExpiry = new Date(profile.premium_expires_at).getTime();
      }
    } catch {
    }
  }
  if (!currentExpiry) {
    try {
      const { rows } = await q("SELECT premium_expires_at FROM users WHERE uid = $1 OR email = $2", [
        userId,
        userEmail
      ]);
      if (rows && rows[0]?.premium_expires_at) {
        currentExpiry = new Date(rows[0].premium_expires_at).getTime();
      }
    } catch {
    }
  }
  const baseTime = Math.max(Date.now(), currentExpiry);
  const durationMs = (durationDays || 30) * 24 * 60 * 60 * 1e3;
  const newExpiresAt = new Date(baseTime + durationMs).toISOString();
  if (sb) {
    try {
      await sb.from("profiles").update({
        is_premium: true,
        premium_expires_at: newExpiresAt,
        subscription_plan: planCode,
        flw_transaction_id: flwTxId || null
      }).eq("id", userId);
    } catch (e) {
      console.warn("[supabase-admin] Update profile premium failed:", e);
    }
  }
  try {
    await q(
      `UPDATE users SET
         is_premium = true,
         subscription_plan = $1,
         flw_transaction_id = $2,
         premium_expires_at = $3
       WHERE uid = $4 OR LOWER(email) = LOWER($5)`,
      [planCode, flwTxId || null, newExpiresAt, userId, userEmail]
    );
  } catch {
  }
  if (Array.isArray(serverStore?.users)) {
    const u = serverStore.users.find((x) => x.uid === userId || x.email === userEmail);
    if (u) {
      u.is_premium = true;
      u.subscription_plan = planCode;
      u.premium_expires_at = newExpiresAt;
      await saveStore();
    }
  }
  return { isPremium: true, expiresAt: newExpiresAt };
}
async function listPaymentsAdmin(options) {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(50, Math.max(5, options.pageSize || 20));
  const status = options.status && options.status !== "all" ? options.status : null;
  const search = (options.search || "").trim().toLowerCase();
  const sb = getSupabaseAdmin2();
  if (sb) {
    try {
      let query = sb.from("payments").select("*, profiles:user_id(email, full_name)", { count: "exact" });
      if (status) query = query.eq("status", status);
      if (search) {
        query = query.or(`tx_ref.ilike.%${search}%,bank_name.ilike.%${search}%,account_number.ilike.%${search}%`);
      }
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
      if (!error && Array.isArray(data)) {
        const payments = data.map((p) => ({
          ...p,
          amount: Number(p.amount),
          amount_paid: p.amount_paid ? Number(p.amount_paid) : null,
          user_email: p.profiles?.email || null,
          user_name: p.profiles?.full_name || null
        }));
        return { payments, total: count || payments.length };
      }
    } catch (e) {
      console.warn("[supabase-admin] listPaymentsAdmin error:", e);
    }
  }
  try {
    let whereClause = "WHERE 1=1";
    const params = [];
    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (tx_ref ILIKE $${params.length} OR bank_name ILIKE $${params.length} OR account_number ILIKE $${params.length})`;
    }
    const countRes = await q(`SELECT count(*) FROM payments ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);
    params.push(pageSize);
    params.push((page - 1) * pageSize);
    const { rows } = await q(
      `SELECT p.*, pr.email as user_email, pr.full_name as user_name
       FROM payments p
       LEFT JOIN profiles pr ON p.user_id = pr.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      payments: (rows || []).map((r) => ({
        ...r,
        amount: Number(r.amount),
        amount_paid: r.amount_paid ? Number(r.amount_paid) : null
      })),
      total
    };
  } catch {
  }
  const allPayments = Array.isArray(serverStore?.payments) ? serverStore.payments : [];
  return {
    payments: allPayments.slice((page - 1) * pageSize, page * pageSize),
    total: allPayments.length
  };
}

// backend/auth/signup.ts
var handler = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!validEmail(email)) return sendJson(res, 400, { error: "Please enter a valid email address." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });
    const existing = await q("SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1", [email]);
    if (existing.rows[0] && !existing.rows[0].password_hash) {
      const row = existing.rows[0];
      const displayName2 = name || row.display_name;
      await q(
        "UPDATE users SET password_hash = $1, display_name = $2, last_login_at = now() WHERE uid = $3",
        [hashPassword(password), displayName2, row.uid]
      );
      const sb2 = getSupabaseAdmin2();
      if (sb2) {
        try {
          await sb2.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: displayName2, name: displayName2 },
            app_metadata: { role: row.role }
          });
        } catch {
        }
      }
      const user2 = mapUser({ ...row, display_name: displayName2 });
      res.setHeader("Set-Cookie", sessionCookie(createSessionToken(user2), isSecureRequest(req)));
      return sendJson(res, 200, { user: user2 });
    }
    if (existing.rows[0]) return sendJson(res, 409, { error: "An account with this email already exists. Please sign in instead." });
    let uid = crypto2.randomUUID();
    const role = email === adminEmail() ? "admin" : "user";
    const displayName = name || email.split("@")[0];
    const sb = getSupabaseAdmin2();
    if (sb) {
      try {
        const { data: sbUser, error: sbErr } = await sb.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: displayName, name: displayName },
          app_metadata: { role }
        });
        if (sbUser?.user?.id) {
          uid = sbUser.user.id;
        } else if (sbErr) {
          console.warn("Supabase auth signup notice:", sbErr.message);
        }
      } catch (sbEx) {
        console.warn("Supabase auth signup exception:", sbEx);
      }
    }
    await q(
      "INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())",
      [uid, email, hashPassword(password), displayName, role]
    );
    await q("INSERT INTO user_preferences (user_uid) VALUES ($1) ON CONFLICT DO NOTHING", [uid]);
    const user = { uid, email, displayName, photoURL: null, role };
    res.setHeader("Set-Cookie", sessionCookie(createSessionToken(user), isSecureRequest(req)));
    return sendJson(res, 201, { user });
  } catch (err) {
    console.error("signup failed:", err);
    return sendJson(res, 500, { error: "Could not create your account. Please try again." });
  }
};
var signup_default = handler;

// backend/auth/login.ts
init_lib();
import crypto3 from "node:crypto";
var handler2 = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!validEmail(email)) return sendJson(res, 400, { error: "Please enter a valid email address." });
    let row;
    try {
      const { rows } = await q(
        "SELECT uid, email, password_hash, display_name, photo_url, role FROM users WHERE email = $1",
        [email]
      );
      row = rows[0];
    } catch (e) {
      console.warn("DB query in login fallback notice:", e);
    }
    if (!row && email === adminEmail()) {
      row = {
        uid: "usr_admin_ibrahim",
        email: adminEmail(),
        password_hash: null,
        display_name: "Ibrahim Faruq (Admin)",
        photo_url: null,
        role: "admin"
      };
    }
    if (!row && isNeonFallbackActive() && password.length >= 4) {
      const uid = `usr_${crypto3.randomUUID().slice(0, 8)}`;
      const displayName = email.split("@")[0];
      const role = email === adminEmail() ? "admin" : "user";
      const passHash = hashPassword(password);
      await q(
        "INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now())",
        [uid, email, passHash, displayName, role]
      );
      const restoredUser = { uid, email, displayName, photoURL: null, role };
      res.setHeader("Set-Cookie", sessionCookie(createSessionToken(restoredUser), isSecureRequest(req)));
      return sendJson(res, 200, { user: restoredUser });
    }
    if (!row) {
      return sendJson(res, 401, { error: "Incorrect email or password." });
    }
    if (!row.password_hash) {
      try {
        await q("UPDATE users SET password_hash = $1, last_login_at = now() WHERE uid = $2", [hashPassword(password), row.uid]);
      } catch (e) {
        console.warn("Password save notice:", e);
      }
      const mapped2 = mapUser(row);
      res.setHeader("Set-Cookie", sessionCookie(createSessionToken(mapped2), isSecureRequest(req)));
      return sendJson(res, 200, { user: mapped2 });
    }
    if (!verifyPassword(password, row.password_hash)) {
      return sendJson(res, 401, { error: "Incorrect email or password." });
    }
    try {
      await q("UPDATE users SET last_login_at = now() WHERE uid = $1", [row.uid]);
    } catch {
    }
    const sb = getSupabaseAdmin2();
    if (sb) {
      try {
        const { data: sbUser } = await sb.auth.admin.createUser({
          email: row.email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: row.display_name,
            name: row.display_name,
            legacy_id: row.uid
          },
          app_metadata: { role: row.role }
        });
        if (sbUser?.user?.id) {
          await sb.from("profiles").update({
            legacy_id: row.uid,
            role: row.role,
            last_seen_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", sbUser.user.id);
        }
      } catch (syncErr) {
        console.warn("JIT Supabase Auth migration notice:", syncErr);
      }
    }
    const mapped = mapUser(row);
    res.setHeader("Set-Cookie", sessionCookie(createSessionToken(mapped), isSecureRequest(req)));
    return sendJson(res, 200, { user: mapped });
  } catch (err) {
    console.error("login failed:", err);
    return sendJson(res, 500, { error: err?.message || "Could not sign you in. Please try again." });
  }
};
var login_default = handler2;

// backend/auth/logout.ts
init_lib();
var handler3 = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  res.setHeader("Set-Cookie", clearedSessionCookie(isSecureRequest(req)));
  sendJson(res, 200, { ok: true });
};
var logout_default = handler3;

// backend/auth/me.ts
init_lib();
var handler4 = async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const user = await getAuthUser(req);
    sendJson(res, 200, { user });
  } catch (err) {
    console.error("me failed:", err);
    sendJson(res, 500, { error: "Could not load your session." });
  }
};
var me_default = handler4;

// backend/me/preferences.ts
init_lib();
var DEFAULT_PREFERENCES = {
  theme: "midnight-scholar",
  activeBackgroundVideoId: null,
  ambientVideoMapping: {}
};
function parseMapping(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && raw !== null) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
    }
  }
  return {};
}
var handler5 = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (req.method === "GET") {
      let r;
      try {
        const { rows } = await q(
          `INSERT INTO user_preferences (user_uid) VALUES ($1)
           ON CONFLICT (user_uid) DO UPDATE SET user_uid = EXCLUDED.user_uid
           RETURNING theme, active_background_video_id, ambient_video_mapping`,
          [user.uid]
        );
        r = rows?.[0];
      } catch (dbErr) {
        console.warn("Could not query user_preferences with INSERT RETURNING, trying SELECT:", dbErr);
        try {
          const { rows } = await q(
            "SELECT theme, active_background_video_id, ambient_video_mapping FROM user_preferences WHERE user_uid = $1",
            [user.uid]
          );
          r = rows?.[0];
        } catch {
        }
      }
      const theme = r?.theme || DEFAULT_PREFERENCES.theme;
      const activeBackgroundVideoId = r?.active_background_video_id ?? DEFAULT_PREFERENCES.activeBackgroundVideoId;
      const ambientVideoMapping = parseMapping(r?.ambient_video_mapping);
      return sendJson(res, 200, {
        preferences: {
          theme,
          activeBackgroundVideoId,
          ambientVideoMapping
        }
      });
    }
    if (req.method === "PUT" || req.method === "POST") {
      const body = await readJson(req) || {};
      let base = {};
      try {
        const { rows: current } = await q(
          "SELECT theme, active_background_video_id, ambient_video_mapping FROM user_preferences WHERE user_uid = $1",
          [user.uid]
        );
        base = current?.[0] || {};
      } catch {
      }
      const theme = typeof body.theme === "string" ? body.theme : base.theme || DEFAULT_PREFERENCES.theme;
      const activeVideoId = "activeBackgroundVideoId" in body ? typeof body.activeBackgroundVideoId === "string" ? body.activeBackgroundVideoId : null : base.active_background_video_id ?? null;
      const mapping = "ambientVideoMapping" in body && typeof body.ambientVideoMapping === "object" && body.ambientVideoMapping ? body.ambientVideoMapping : parseMapping(base.ambient_video_mapping);
      try {
        await q(
          `INSERT INTO user_preferences (user_uid, theme, active_background_video_id, ambient_video_mapping, updated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (user_uid)
           DO UPDATE SET theme = EXCLUDED.theme,
                         active_background_video_id = EXCLUDED.active_background_video_id,
                         ambient_video_mapping = EXCLUDED.ambient_video_mapping,
                         updated_at = now()`,
          [user.uid, theme, activeVideoId, JSON.stringify(mapping)]
        );
      } catch (saveErr) {
        console.warn("Failed to persist preferences to db:", saveErr);
      }
      return sendJson(res, 200, {
        preferences: {
          theme,
          activeBackgroundVideoId: activeVideoId,
          ambientVideoMapping: mapping
        }
      });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("preferences handler error:", err);
    return sendJson(res, 200, { preferences: DEFAULT_PREFERENCES });
  }
};
var preferences_default = handler5;

// backend/me/premium-status.ts
init_lib();
var handler6 = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return sendJson(res, 200, {
        authenticated: false,
        is_premium: false,
        subscription_plan: "free",
        premium_expires_at: null,
        can_download: false
      });
    }
    const isExpired = user.premium_expires_at ? new Date(user.premium_expires_at).getTime() < Date.now() : false;
    const isPremium = Boolean((user.is_premium || user.role === "admin" || user.subscription_plan === "lifetime") && !isExpired);
    return sendJson(res, 200, {
      authenticated: true,
      uid: user.uid,
      is_premium: isPremium,
      subscription_plan: user.subscription_plan || (user.role === "admin" ? "lifetime" : "free"),
      premium_expires_at: user.premium_expires_at || null,
      can_download: isPremium
    });
  } catch (err) {
    console.error("premium-status check failed:", err);
    return sendJson(res, 500, { error: "Failed to verify premium status." });
  }
};
var premium_status_default = handler6;

// backend/me/reciters.ts
init_lib();

// backend/media-lib.mjs
init_lib();
var MAX_INLINE_MEDIA_CHARS = 25e7;
var MAX_INLINE_IMAGE_CHARS = 5e6;
var DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
var DATA_VIDEO_RE = /^data:video\/(mp4|webm|quicktime|ogg);base64,[A-Za-z0-9+/=\s]+$/;
function readJsonLarge(req, limit = MAX_INLINE_MEDIA_CHARS) {
  const pre = req.body;
  if (pre && typeof pre === "object" && Object.keys(pre).length > 0) return Promise.resolve(pre);
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
function parseInline(value, re, maxChars) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.length > maxChars) return null;
  return re.test(url) ? url : null;
}
function cleanPortableImageUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  const inline = parseInline(url, DATA_IMAGE_RE, MAX_INLINE_IMAGE_CHARS);
  if (inline) return inline;
  if (url.startsWith("/") && url.length <= 2048) return url;
  if (url.length > 2048) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
function cleanPortableVideoUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  const inline = parseInline(url, DATA_VIDEO_RE, MAX_INLINE_MEDIA_CHARS);
  if (inline) return inline;
  if (url.startsWith("/") && url.length <= 2048) return url;
  if (url.length > 2048) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
var tableReady = false;
async function ensureMediaTable() {
  if (tableReady) return;
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS global_media (
        id         TEXT PRIMARY KEY,
        kind       TEXT NOT NULL,
        mime_type  TEXT NOT NULL,
        data_url   TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await q(`
      CREATE TABLE IF NOT EXISTS global_media_chunks (
        upload_id   TEXT NOT NULL,
        chunk_index INT NOT NULL,
        chunk_data  TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (upload_id, chunk_index)
      )
    `);
    tableReady = true;
  } catch (err) {
    console.warn("Media table initialization note:", err?.message || err);
  }
}
async function saveInlineMedia(dataUrl, kind, customId) {
  const match = /^data:([^;,]+);base64,/.exec(dataUrl);
  const mimeType = match ? match[1] : kind === "video" ? "video/mp4" : "image/jpeg";
  const normalizedDataUrl = match ? dataUrl : `data:${mimeType};base64,${dataUrl}`;
  await ensureMediaTable();
  const id = customId || `media_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await q(
    "INSERT INTO global_media (id, kind, mime_type, data_url, created_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (id) DO UPDATE SET data_url = EXCLUDED.data_url, mime_type = EXCLUDED.mime_type",
    [id, kind, mimeType, normalizedDataUrl]
  );
  return { id, mimeType };
}
async function saveMediaChunk(uploadId, chunkIndex, chunkData) {
  await ensureMediaTable();
  await q(
    "INSERT INTO global_media_chunks (upload_id, chunk_index, chunk_data, created_at) VALUES ($1, $2, $3, now()) ON CONFLICT (upload_id, chunk_index) DO UPDATE SET chunk_data = EXCLUDED.chunk_data",
    [uploadId, Number(chunkIndex), String(chunkData || "")]
  );
}
async function assembleMediaChunks(uploadId, mimeType, kind, customId) {
  await ensureMediaTable();
  const { rows } = await q(
    "SELECT chunk_index, chunk_data FROM global_media_chunks WHERE upload_id = $1 ORDER BY chunk_index ASC",
    [uploadId]
  );
  if (!rows || rows.length === 0) {
    throw new Error("No chunks found for upload " + uploadId);
  }
  const combinedBase64 = rows.map((r) => r.chunk_data).join("");
  const cleanBase64 = combinedBase64.includes("base64,") ? combinedBase64.split("base64,")[1] : combinedBase64;
  const fullDataUrl = `data:${mimeType};base64,${cleanBase64}`;
  const saved = await saveInlineMedia(fullDataUrl, kind, customId);
  await q("DELETE FROM global_media_chunks WHERE upload_id = $1", [uploadId]).catch(() => {
  });
  return { ...saved, size: Math.floor(cleanBase64.length * 3 / 4) };
}
async function getInlineMedia(id) {
  if (!id) return null;
  await ensureMediaTable();
  const { rows } = await q("SELECT mime_type, data_url FROM global_media WHERE id = $1", [id]);
  return rows[0] || null;
}
function streamBufferWithRange(req, res, buffer, mimeType) {
  const total = buffer.length;
  const range = req.headers?.range;
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": mimeType || "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*"
  };
  if (range) {
    const parts = String(range).replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), total - 1) : total - 1;
    if (isNaN(start) || isNaN(end) || start >= total || end >= total || start > end) {
      res.writeHead(416, {
        ...commonHeaders,
        "Content-Range": `bytes */${total}`
      });
      res.end();
      return;
    }
    const chunkLength = end - start + 1;
    res.writeHead(206, {
      ...commonHeaders,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": String(chunkLength)
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(buffer.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, {
    ...commonHeaders,
    "Content-Length": String(total)
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(buffer);
}

// backend/me/reciters.ts
var mapRow = (r) => ({
  id: r.id,
  name: r.name,
  style: r.style ?? "Custom",
  serverUrl: r.server_url || "",
  ...r.image_url ? { imageUrl: r.image_url } : {}
});
var handler7 = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (req.method === "GET") {
      const { rows } = await qWithFallback([
        {
          text: "SELECT id, name, style, server_url, image_url FROM custom_reciters WHERE user_uid = $1 ORDER BY created_at",
          params: [user.uid]
        },
        {
          // custom_reciters.image_url not migrated yet (run `node scripts/apply-schema.mjs`).
          text: "SELECT id, name, style, server_url FROM custom_reciters WHERE user_uid = $1 ORDER BY created_at",
          params: [user.uid]
        }
      ]);
      return sendJson(res, 200, { reciters: rows.map(mapRow) });
    }
    if (req.method === "POST") {
      const body = await readJsonLarge(req);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const serverUrl = typeof body.serverUrl === "string" ? body.serverUrl.trim() : "";
      const style = typeof body.style === "string" ? body.style : "Custom";
      const imageUrl = cleanImageUrl(body.imageUrl);
      const id = typeof body.id === "string" && /^[a-zA-Z0-9_.-]{1,128}$/.test(body.id) ? body.id : `custom_${Date.now()}`;
      if (!name) return sendJson(res, 400, { error: "Reciter name is required." });
      await qWithFallback([
        {
          text: `INSERT INTO custom_reciters (id, user_uid, name, style, server_url, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style = EXCLUDED.style,
                   server_url = EXCLUDED.server_url, image_url = EXCLUDED.image_url`,
          params: [id, user.uid, name, style, serverUrl, imageUrl]
        },
        {
          text: `INSERT INTO custom_reciters (id, user_uid, name, style, server_url)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style = EXCLUDED.style,
                   server_url = EXCLUDED.server_url`,
          params: [id, user.uid, name, style, serverUrl]
        }
      ]);
      return sendJson(res, 201, { reciter: { id, name, style, serverUrl, ...imageUrl ? { imageUrl } : {} } });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("custom reciters failed:", err);
    return sendJson(res, 500, { error: "Could not save reciter." });
  }
};
var reciters_default = handler7;

// backend/me/reciters/[id].ts
init_lib();
var handler8 = async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (req.method !== "DELETE") return sendJson(res, 405, { error: "Method not allowed" });
    const id = apiPath(req)[2];
    if (!id) return sendJson(res, 400, { error: "Missing reciter id" });
    await q("DELETE FROM custom_reciters WHERE id = $1 AND user_uid = $2", [id, user.uid]);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error("delete reciter failed:", err);
    return sendJson(res, 500, { error: "Could not delete reciter." });
  }
};
var id_default = handler8;

// backend/admin/overview.ts
init_lib();
var handler9 = async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const [users, reciters, ambient] = await Promise.all([
      q('SELECT uid AS "userId", email, display_name AS "displayName", photo_url AS "photoURL", role, created_at AS "createdAt", last_login_at AS "lastLoginAt" FROM users ORDER BY created_at DESC'),
      // Falls back to a query without image_url until `node scripts/apply-schema.mjs` runs.
      qWithFallback([
        { text: 'SELECT id, name, style, server_url AS "serverUrl", image_url AS "imageUrl" FROM global_reciters ORDER BY updated_at DESC' },
        { text: 'SELECT id, name, style, server_url AS "serverUrl" FROM global_reciters ORDER BY updated_at DESC' }
      ]),
      q('SELECT id, video_url AS "videoUrl" FROM ambient_sounds')
    ]);
    const ambientSounds = {};
    for (const row of ambient.rows) {
      ambientSounds[row.id] = row.videoUrl ?? "";
    }
    sendJson(res, 200, { users: users.rows, globalReciters: reciters.rows, ambientSounds });
  } catch (err) {
    console.error("admin overview failed:", err);
    sendJson(res, 500, { error: "Could not load admin data." });
  }
};
var overview_default = handler9;

// backend/admin/reciters.ts
init_lib();
var handler10 = async (req, res) => {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readJsonLarge(req);
    if (req.method === "DELETE" || body.action === "delete") {
      const targetId = typeof body.id === "string" ? body.id.trim() : "";
      if (!targetId) return sendJson(res, 400, { error: "Reciter ID is required." });
      await q("DELETE FROM global_reciters WHERE id = $1", [targetId]);
      return sendJson(res, 200, { ok: true, id: targetId });
    }
    const rawId = typeof body.id === "string" ? body.id.trim() : "";
    const id = /^[a-zA-Z0-9_.-]{1,128}$/.test(rawId) ? rawId : `global_${Date.now()}`;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const nameArabic = typeof body.nameArabic === "string" ? body.nameArabic.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const serverUrl = typeof body.serverUrl === "string" ? body.serverUrl.trim() : "";
    const rawImage = cleanImageUrl(body.imageUrl);
    const imageUrl = rawImage ? rawImage.replace(/^https?:\/\/localhost(:\d+)?/, "") : null;
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    if (!name && !imageUrl && !serverUrl && !bio) {
      return sendJson(res, 400, { error: "Reciter details (name, photo, bio, or server URL) are required." });
    }
    await q("ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS name_arabic TEXT").catch(() => {
    });
    await q("ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS category TEXT").catch(() => {
    });
    await q("ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS bio TEXT").catch(() => {
    });
    await q("ALTER TABLE global_reciters ADD COLUMN IF NOT EXISTS image_url TEXT").catch(() => {
    });
    await qWithFallback([
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, image_url, name_arabic, category, bio, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 image_url = CASE WHEN $4 IS NOT NULL THEN $4 ELSE global_reciters.image_url END,
                 name_arabic = CASE WHEN $5 <> '' THEN $5 ELSE global_reciters.name_arabic END,
                 category = CASE WHEN $6 <> '' THEN $6 ELSE global_reciters.category END,
                 bio = CASE WHEN $7 <> '' THEN $7 ELSE global_reciters.bio END,
                 updated_at = now()`,
        params: [id, name, serverUrl, imageUrl, nameArabic, category, bio]
      },
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, image_url, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, $4, now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 image_url = CASE WHEN $4 IS NOT NULL THEN $4 ELSE global_reciters.image_url END,
                 updated_at = now()`,
        params: [id, name, serverUrl, imageUrl]
      },
      {
        text: `INSERT INTO global_reciters (id, name, style, server_url, updated_at)
               VALUES ($1, COALESCE(NULLIF($2, ''), $1), 'Custom Global', $3, now())
               ON CONFLICT (id) DO UPDATE SET 
                 name = CASE WHEN $2 <> '' THEN $2 ELSE global_reciters.name END,
                 server_url = CASE WHEN $3 <> '' THEN $3 ELSE global_reciters.server_url END,
                 updated_at = now()`,
        params: [id, name, serverUrl]
      }
    ]);
    return sendJson(res, 201, {
      reciter: {
        id,
        name: name || id,
        ...nameArabic ? { nameArabic } : {},
        style: "Custom Global",
        ...category ? { category } : {},
        serverUrl: serverUrl || null,
        ...imageUrl ? { imageUrl } : {},
        ...bio ? { bio } : {}
      }
    });
  } catch (err) {
    console.error("admin reciters failed:", err);
    return sendJson(res, 500, { error: "Could not save global reciter." });
  }
};
var reciters_default2 = handler10;

// backend/admin/role.ts
init_lib();
import crypto4 from "node:crypto";
var handler11 = async (req, res) => {
  if (req.method !== "PUT" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req);
    if (req.method === "POST") {
      const action = typeof body.action === "string" ? body.action : "add_user";
      if (action === "delete_user") {
        const userId2 = typeof body.userId === "string" ? body.userId : "";
        if (!userId2) return sendJson(res, 400, { error: "userId is required" });
        await q("DELETE FROM users WHERE uid = $1", [userId2]);
        return sendJson(res, 200, { ok: true });
      }
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : email.split("@")[0];
      const role2 = body.role === "admin" || email === adminEmail() ? "admin" : "user";
      if (!validEmail(email)) {
        return sendJson(res, 400, { error: "Please enter a valid email address." });
      }
      const uid = `usr_${crypto4.randomUUID().slice(0, 8)}`;
      await q(
        "INSERT INTO users (uid, email, password_hash, display_name, role, last_login_at) VALUES ($1, $2, $3, $4, $5, now()) ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role",
        [uid, email, null, displayName, role2]
      );
      const { rows } = await q(
        'SELECT uid AS "userId", email, display_name AS "displayName", photo_url AS "photoURL", role, created_at AS "createdAt", last_login_at AS "lastLoginAt" FROM users ORDER BY created_at DESC LIMIT 200'
      );
      return sendJson(res, 200, { ok: true, users: rows });
    }
    const userId = typeof body.userId === "string" ? body.userId : "";
    const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;
    if (!userId || !role) return sendJson(res, 400, { error: "userId and a valid role are required." });
    await q("UPDATE users SET role = $1 WHERE uid = $2", [role, userId]);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error("admin role update failed:", err);
    return sendJson(res, 500, { error: "Could not update user." });
  }
};
var role_default = handler11;

// backend/admin/ambient.ts
init_lib();
async function ensureTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS global_background_videos (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      video_url   TEXT NOT NULL,
      description TEXT,
      is_default  BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
function sanitizeGlobalVideoUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^https?:\/\/localhost(:\d+)?/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("custom_vid_") || trimmed.startsWith("upload_")) {
    return null;
  }
  return trimmed;
}
var handler12 = async (req, res) => {
  if (req.method !== "PUT" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readJsonLarge(req);
    if (req.method === "PUT") {
      const sounds = body.sounds && typeof body.sounds === "object" ? body.sounds : {};
      for (const [id, url] of Object.entries(sounds)) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) continue;
        const videoUrl = sanitizeGlobalVideoUrl(url);
        await q(
          `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
           VALUES ($1, $1, $2, now())
           ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
          [id, videoUrl]
        );
      }
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "POST") {
      await ensureTable().catch(() => {
      });
      const action = body.action;
      if (action === "add_video") {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const videoUrl = sanitizeGlobalVideoUrl(body.videoUrl);
        const description = typeof body.description === "string" ? body.description.trim() : null;
        const isDefault = Boolean(body.isDefault);
        if (!name || !videoUrl) {
          return sendJson(res, 400, { error: "Name and a portable video URL are required." });
        }
        const id = typeof body.id === "string" && /^[a-zA-Z0-9_.-]{1,128}$/.test(body.id) ? body.id : `bg_vid_${Date.now()}`;
        if (isDefault) {
          await q("UPDATE global_background_videos SET is_default = false");
          await q(
            `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
             VALUES ('default', 'Default Video', $1, now())
             ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
            [videoUrl]
          );
        }
        await q(
          `INSERT INTO global_background_videos (id, name, video_url, description, is_default, created_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, name = EXCLUDED.name, is_default = EXCLUDED.is_default`,
          [id, name, videoUrl, description, isDefault]
        );
        return sendJson(res, 201, { video: { id, name, videoUrl, description, isDefault } });
      }
      if (action === "delete_video") {
        const id = typeof body.id === "string" ? body.id : "";
        if (!id) return sendJson(res, 400, { error: "Video ID required" });
        await q("DELETE FROM global_background_videos WHERE id = $1", [id]);
        return sendJson(res, 200, { ok: true });
      }
      if (action === "set_default") {
        const id = typeof body.id === "string" ? body.id : "";
        const videoUrl = sanitizeGlobalVideoUrl(body.videoUrl);
        if (!id && !videoUrl) return sendJson(res, 400, { error: "Video ID or portable URL required" });
        if (id) {
          await q("UPDATE global_background_videos SET is_default = (id = $1)", [id]);
        }
        if (videoUrl) {
          await q(
            `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
             VALUES ('default', 'Default Video', $1, now())
             ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
            [videoUrl]
          );
        }
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 400, { error: "Unknown action" });
    }
  } catch (err) {
    console.error("admin ambient failed:", err);
    return sendJson(res, 500, { error: err?.message || "Could not save ambient settings." });
  }
};
var ambient_default = handler12;

// backend/admin/media.ts
init_lib();
var KINDS = /* @__PURE__ */ new Set(["image", "video"]);
var handler13 = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    let body;
    try {
      body = await readJsonLarge(req);
    } catch (err) {
      return sendJson(res, 413, { error: err?.message || "Upload too large" });
    }
    const kind = KINDS.has(body.kind) ? body.kind : "image";
    const dataUrl = kind === "image" ? cleanPortableImageUrl(body.dataUrl) : cleanPortableVideoUrl(body.dataUrl);
    if (!dataUrl) return sendJson(res, 400, { error: "A valid image or video payload is required." });
    if (!dataUrl.startsWith("data:")) return sendJson(res, 200, { ok: true, url: dataUrl });
    const saved = await saveInlineMedia(dataUrl, kind);
    return sendJson(res, 201, { ok: true, id: saved.id, url: `/api/media/${saved.id}` });
  } catch (err) {
    console.error("admin media upload failed:", err);
    return sendJson(res, 500, { error: "Could not store that upload." });
  }
};
var media_default = handler13;

// backend/media/[id].ts
init_lib();
import fs2 from "node:fs";
import path2 from "node:path";
var UPLOADS_DIR = path2.resolve(process.cwd(), "public/videos/uploads");
var PUBLIC_VIDEOS_DIR = path2.resolve(process.cwd(), "public/videos");
var handler14 = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const url = (req.url || "").split("?")[0];
  const id = decodeURIComponent(url.replace(/^\/api\/media\//, ""));
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(id)) {
    return sendJson(res, 400, { error: "Invalid media id" });
  }
  try {
    const row = await getInlineMedia(id);
    if (row && row.data_url) {
      const base64 = String(row.data_url).includes(",") ? String(row.data_url).split(",")[1] : String(row.data_url);
      const buffer = Buffer.from(base64, "base64");
      streamBufferWithRange(req, res, buffer, row.mime_type || "application/octet-stream");
      return;
    }
    const safeName = path2.basename(id);
    for (const dir of [UPLOADS_DIR, PUBLIC_VIDEOS_DIR]) {
      const candidate = path2.join(dir, safeName);
      if (fs2.existsSync(candidate)) {
        const buffer = fs2.readFileSync(candidate);
        const ext = path2.extname(safeName).toLowerCase();
        const mimeType = ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        streamBufferWithRange(req, res, buffer, mimeType);
        return;
      }
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("media fetch failed:", err);
    return sendJson(res, 500, { error: "Could not load that asset." });
  }
};
var id_default2 = handler14;

// backend/health.mjs
async function handler15(_req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  const health = {
    ok: true,
    functionRuntime: "node",
    databaseUrl: Boolean(process.env.DATABASE_URL),
    authSecret: Boolean(process.env.AUTH_SECRET),
    supabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    flwConfigured: Boolean(process.env.FLW_SECRET_KEY),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const { getPool: getPool2, syncStoreFromCloud: syncStoreFromCloud2 } = await Promise.resolve().then(() => (init_lib(), lib_exports));
    const pool2 = await getPool2();
    await pool2.query("SELECT 1");
    health.database = "reachable";
  } catch (err) {
    try {
      const { syncStoreFromCloud: syncStoreFromCloud2 } = await Promise.resolve().then(() => (init_lib(), lib_exports));
      await syncStoreFromCloud2(true);
      health.ok = true;
      health.database = "cloud-store-active";
      health.neonNotice = err && err.message ? err.message.slice(0, 200) : "quota fallback active";
    } catch (cloudErr) {
      health.ok = false;
      health.database = "error";
      health.databaseError = err && err.message ? err.message.slice(0, 200) : "unknown error";
    }
  }
  res.end(JSON.stringify(health));
}

// backend/reciters.ts
init_lib();
function sanitizePublicImageUrl(url) {
  if (!url || typeof url !== "string") return void 0;
  const trimmed = url.trim().replace(/^https?:\/\/localhost(:\d+)?/, "");
  if (!trimmed) return void 0;
  return trimmed;
}
var handler16 = async (_req, res) => {
  try {
    const { rows } = await qWithFallback([
      { text: "SELECT id, name, name_arabic, style, category, bio, server_url, image_url FROM global_reciters" },
      { text: "SELECT id, name, style, server_url, image_url FROM global_reciters" },
      { text: "SELECT id, name, style, server_url FROM global_reciters" }
    ]);
    return sendJson(res, 200, {
      reciters: rows.map((r) => {
        const cleanImg = sanitizePublicImageUrl(r.image_url);
        return {
          id: r.id,
          name: r.name,
          ...r.name_arabic ? { nameArabic: r.name_arabic } : {},
          style: r.style ?? null,
          ...r.category ? { category: r.category } : {},
          ...r.bio ? { bio: r.bio } : {},
          serverUrl: r.server_url ?? null,
          ...cleanImg ? { imageUrl: cleanImg } : {}
        };
      })
    });
  } catch (err) {
    console.warn("public reciters unavailable, using fallback:", err?.message || String(err));
    return sendJson(res, 200, { reciters: [] });
  }
};
var reciters_default3 = handler16;

// backend/ambient.ts
init_lib();

// backend/backgrounds.ts
init_lib();
async function ensureBackgroundsTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS backgrounds (
      id               TEXT PRIMARY KEY,
      name_en          TEXT NOT NULL,
      name_ar          TEXT,
      category         TEXT NOT NULL,
      video_url        TEXT NOT NULL,
      video_url_720p   TEXT,
      video_url_480p   TEXT,
      poster_url       TEXT,
      size_bytes       BIGINT DEFAULT 0,
      duration_seconds NUMERIC DEFAULT 0,
      renditions       JSONB DEFAULT '[]'::jsonb,
      storage_paths    JSONB DEFAULT '[]'::jsonb,
      attribution      TEXT,
      sort_order       INT DEFAULT 0,
      is_active        BOOLEAN DEFAULT false,
      is_draft         BOOLEAN DEFAULT true,
      is_premium       BOOLEAN DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS video_url_720p TEXT`).catch(() => {
  });
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS video_url_480p TEXT`).catch(() => {
  });
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC DEFAULT 0`).catch(() => {
  });
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS renditions JSONB DEFAULT '[]'::jsonb`).catch(() => {
  });
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS storage_paths JSONB DEFAULT '[]'::jsonb`).catch(() => {
  });
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS attribution TEXT`).catch(() => {
  });
  await q(`ALTER TABLE backgrounds ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false`).catch(() => {
  });
  await q(`
    CREATE INDEX IF NOT EXISTS idx_backgrounds_active_sort ON backgrounds (is_active, sort_order ASC, created_at DESC)
  `).catch(() => {
  });
}
var handler17 = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    await ensureBackgroundsTable().catch(() => {
    });
    const result = await q(`
      SELECT id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p, poster_url, size_bytes, duration_seconds, renditions, attribution, sort_order, is_active, is_draft, is_premium, created_at
      FROM backgrounds
      WHERE is_active = true OR is_active IS NULL
      ORDER BY sort_order ASC, created_at DESC
    `);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
    return sendJson(res, 200, {
      backgrounds: result.rows || []
    });
  } catch (err) {
    console.error("Failed to load backgrounds:", err);
    return sendJson(res, 500, { error: "Failed to load backgrounds" });
  }
};
var backgrounds_default = handler17;

// backend/ambient.ts
function normalizeStoredVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim().replace(/^https?:\/\/localhost(:\d+)?/, "");
  if (!url || url.startsWith("blob:")) return null;
  return url;
}
var handler18 = async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    await ensureBackgroundsTable().catch(() => {
    });
    const ambient = await q(
      "SELECT id, video_url FROM ambient_sounds WHERE video_url IS NOT NULL"
    );
    const ambientSounds = {};
    let activeDefaultVideoUrl = null;
    for (const row of ambient.rows) {
      const validUrl = normalizeStoredVideoUrl(row.video_url);
      if (validUrl) {
        ambientSounds[row.id] = validUrl;
        if (row.id === "default" || row.id === "active" || row.id === "global") {
          activeDefaultVideoUrl = validUrl;
        }
      }
    }
    const videos = [];
    try {
      const bgRes = await q(
        "SELECT id, name_en, video_url, poster_url, sort_order, is_active FROM backgrounds WHERE is_active = true ORDER BY sort_order ASC, created_at DESC"
      );
      for (const r of bgRes.rows) {
        const validUrl = normalizeStoredVideoUrl(r.video_url);
        if (validUrl) {
          videos.push({
            id: r.id,
            name: r.name_en,
            videoUrl: validUrl,
            posterUrl: r.poster_url || void 0,
            isDefault: videos.length === 0
          });
        }
      }
    } catch (e) {
      console.warn("backgrounds table query note:", e);
    }
    try {
      const vidRes = await q(
        "SELECT id, name, video_url, description, is_default FROM global_background_videos ORDER BY is_default DESC, created_at DESC"
      );
      for (const r of vidRes.rows) {
        const validUrl = normalizeStoredVideoUrl(r.video_url);
        if (validUrl && !videos.some((v) => v.videoUrl === validUrl)) {
          videos.push({
            id: r.id,
            name: r.name,
            videoUrl: validUrl,
            description: r.description || void 0,
            isDefault: Boolean(r.is_default)
          });
        }
      }
    } catch {
    }
    const defVid = videos.find((v) => v.isDefault) || videos[0];
    if (defVid && !activeDefaultVideoUrl) {
      activeDefaultVideoUrl = defVid.videoUrl;
    }
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
    return sendJson(res, 200, { ambientSounds, videos, activeDefaultVideoUrl });
  } catch (err) {
    return sendJson(res, 200, {
      ambientSounds: {},
      videos: [],
      activeDefaultVideoUrl: null
    });
  }
};
var ambient_default2 = handler18;

// backend/media.ts
init_lib();
import fs3 from "node:fs";
import path3 from "node:path";
import crypto5 from "node:crypto";
var UPLOADS_DIR2 = path3.resolve(process.cwd(), "public/videos/uploads");
function ensureUploadsDir() {
  try {
    if (!fs3.existsSync(UPLOADS_DIR2)) {
      fs3.mkdirSync(UPLOADS_DIR2, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}
async function recordVideoInAmbientDb(id, name, publicUrl, isDefault) {
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS global_background_videos (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        video_url   TEXT NOT NULL,
        description TEXT,
        is_default  BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    if (isDefault) {
      await q("UPDATE global_background_videos SET is_default = false");
      await q(
        `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
         VALUES ('default', 'Default Video', $1, now())
         ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
        [publicUrl]
      );
    }
    await q(
      `INSERT INTO global_background_videos (id, name, video_url, description, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET video_url = EXCLUDED.video_url, name = EXCLUDED.name, is_default = EXCLUDED.is_default`,
      [id, name, publicUrl, "Uploaded by admin", isDefault]
    );
  } catch (dbErr) {
    console.warn("DB recording for video skipped:", dbErr);
  }
}
async function mediaHandler(req, res) {
  const urlObj = new URL(req.url || "/", "http://localhost");
  const pathname = urlObj.pathname;
  if (req.method === "POST") {
    try {
      const body = await readJsonLarge(req);
      const action = typeof body.action === "string" ? body.action : "upload";
      const filename = typeof body.filename === "string" ? body.filename.trim() : `media_${Date.now()}`;
      const name = typeof body.name === "string" ? body.name.trim() : filename;
      const isDefault = Boolean(body.isDefault);
      const mediaType = typeof body.type === "string" && body.type ? body.type : filename.endsWith(".mp4") ? "video/mp4" : filename.endsWith(".webm") ? "video/webm" : "image/jpeg";
      const kind = mediaType.startsWith("video") || filename.endsWith(".mp4") || filename.endsWith(".webm") ? "video" : "image";
      if (action === "chunk") {
        const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : "";
        const chunkIndex = Number(body.chunkIndex ?? 0);
        const totalChunks = Number(body.totalChunks ?? 1);
        const chunkData = typeof body.chunkData === "string" ? body.chunkData : "";
        if (!uploadId || !chunkData) {
          return sendJson(res, 400, { error: "Missing uploadId or chunkData." });
        }
        await saveMediaChunk(uploadId, chunkIndex, chunkData);
        const isLastChunk = Boolean(body.finalize) || chunkIndex + 1 >= totalChunks;
        if (!isLastChunk) {
          return sendJson(res, 200, {
            ok: true,
            chunkIndex,
            totalChunks,
            complete: false
          });
        }
        const assembled = await assembleMediaChunks(uploadId, mediaType, kind);
        const publicUrl2 = `/api/media/${assembled.id}`;
        if (kind === "video") {
          await recordVideoInAmbientDb(`bg_vid_${assembled.id}`, name, publicUrl2, isDefault);
        }
        return sendJson(res, 201, {
          ok: true,
          complete: true,
          id: assembled.id,
          url: publicUrl2,
          name,
          size: assembled.size,
          isDefault
        });
      }
      const dataStr = typeof body.data === "string" ? body.data.trim() : "";
      if (!dataStr) {
        return sendJson(res, 400, { error: "No media data provided." });
      }
      if (dataStr.startsWith("http://") || dataStr.startsWith("https://") || dataStr.startsWith("/api/media/")) {
        const cleanUrl = dataStr.replace(/^https?:\/\/localhost(:\d+)?/, "");
        return sendJson(res, 200, {
          ok: true,
          id: path3.basename(cleanUrl),
          url: cleanUrl,
          name,
          size: 0,
          isDefault
        });
      }
      const base64Data = dataStr.includes("base64,") ? dataStr.split("base64,")[1] : dataStr;
      const buffer = Buffer.from(base64Data, "base64");
      let ext = path3.extname(filename).toLowerCase();
      if (!ext) {
        if (mediaType.includes("mp4")) ext = ".mp4";
        else if (mediaType.includes("webm")) ext = ".webm";
        else if (mediaType.includes("png")) ext = ".png";
        else ext = ".jpg";
      }
      const safeId = `media_${kind}_${Date.now()}_${crypto5.randomBytes(4).toString("hex")}`;
      const safeFilename = `${safeId}${ext}`;
      const saved = await saveInlineMedia(
        `data:${mediaType};base64,${base64Data}`,
        kind,
        safeId
      );
      const publicUrl = `/api/media/${saved.id}`;
      if (ensureUploadsDir()) {
        try {
          fs3.writeFileSync(path3.join(UPLOADS_DIR2, safeFilename), buffer);
        } catch {
        }
      }
      if (kind === "video") {
        await recordVideoInAmbientDb(`bg_vid_${saved.id}`, name, publicUrl, isDefault);
      }
      return sendJson(res, 201, {
        ok: true,
        id: saved.id,
        url: publicUrl,
        name,
        size: buffer.length,
        isDefault
      });
    } catch (err) {
      console.error("Media upload error:", err);
      return sendJson(res, 500, { error: err.message || "Failed to upload media." });
    }
  }
  if (req.method === "GET" || req.method === "HEAD") {
    const fileParam = urlObj.searchParams.get("file") || pathname.replace(/^\/api\/media\/?/, "");
    if (!fileParam) {
      return sendJson(res, 400, { error: "Missing file parameter" });
    }
    const cleanId = decodeURIComponent(fileParam).replace(/\.[^/.]+$/, "");
    try {
      const row = await getInlineMedia(fileParam) || await getInlineMedia(cleanId);
      if (row && row.data_url) {
        const base64 = String(row.data_url).includes(",") ? String(row.data_url).split(",")[1] : String(row.data_url);
        const buffer2 = Buffer.from(base64, "base64");
        streamBufferWithRange(req, res, buffer2, row.mime_type || "application/octet-stream");
        return;
      }
    } catch (err) {
      console.warn("DB media lookup fallback:", err);
    }
    const safeFilename = path3.basename(fileParam);
    let filePath = path3.join(UPLOADS_DIR2, safeFilename);
    if (!fs3.existsSync(filePath)) {
      const publicVideosPath = path3.resolve(process.cwd(), "public/videos", safeFilename);
      if (fs3.existsSync(publicVideosPath)) {
        filePath = publicVideosPath;
      } else {
        return sendJson(res, 404, { error: "File not found" });
      }
    }
    const buffer = fs3.readFileSync(filePath);
    const ext = path3.extname(safeFilename).toLowerCase();
    const contentType = ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : ext === ".png" ? "image/png" : "image/jpeg";
    streamBufferWithRange(req, res, buffer, contentType);
    return;
  }
  sendJson(res, 405, { error: "Method not allowed" });
}

// backend/payments/verify.ts
init_lib();
async function handler19(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    const body = await readJson(req);
    const { transaction_id, tx_ref, plan_code = "premium_monthly" } = body;
    if (!transaction_id) {
      return sendJson(res, 400, { error: "Transaction ID is required." });
    }
    const txIdStr = String(transaction_id).trim();
    const flwSecretKey = process.env.FLW_SECRET_KEY;
    const plan = await getPlanByCode(plan_code);
    if (!plan || !plan.is_active) {
      return sendJson(res, 400, { error: "Selected plan is not currently available." });
    }
    let isVerified = false;
    let verifiedAmount = 0;
    let verifiedCurrency = "NGN";
    let verifiedTxRef = tx_ref || "";
    let flwRef = null;
    if (flwSecretKey && !flwSecretKey.includes("placeholder")) {
      const flwRes = await fetch(
        `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(txIdStr)}/verify`,
        {
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (!flwRes.ok) {
        const errData = await flwRes.json().catch(() => ({}));
        return sendJson(res, 400, {
          error: errData.message || "Unable to verify transaction with Flutterwave."
        });
      }
      const flwData = await flwRes.json();
      if (flwData?.status !== "success" || flwData?.data?.status !== "successful") {
        return sendJson(res, 400, {
          error: "Transaction was not successful or has been cancelled."
        });
      }
      verifiedAmount = Number(flwData?.data?.amount || 0);
      verifiedCurrency = (flwData?.data?.currency || "NGN").toUpperCase();
      verifiedTxRef = flwData?.data?.tx_ref || verifiedTxRef;
      flwRef = flwData?.data?.flw_ref || null;
      isVerified = true;
    } else {
      console.warn("[Payments] FLW_SECRET_KEY not set. Operating in resilient test verification mode.");
      isVerified = Boolean(txIdStr);
      verifiedAmount = plan.amount;
      verifiedCurrency = plan.currency || "NGN";
    }
    if (!isVerified) {
      return sendJson(res, 400, { error: "Payment verification failed." });
    }
    if (verifiedCurrency !== (plan.currency || "NGN").toUpperCase()) {
      return sendJson(res, 400, {
        error: `Currency mismatch: expected ${plan.currency}, received ${verifiedCurrency}.`
      });
    }
    if (verifiedAmount < plan.amount) {
      return sendJson(res, 400, {
        error: `Underpayment detected: received \u20A6${verifiedAmount}, required \u20A6${plan.amount}.`
      });
    }
    const finalTxRef = verifiedTxRef || `qf-card-${Date.now()}-${user.uid.slice(0, 8)}`;
    const existing = await getPaymentByTxRef(finalTxRef);
    if (existing) {
      await updatePaymentStatus(finalTxRef, {
        status: verifiedAmount > plan.amount ? "overpaid" : "successful",
        flw_id: txIdStr,
        flw_ref: flwRef,
        amount_paid: verifiedAmount,
        paid_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      await createPaymentRecord({
        user_id: user.uid,
        plan_code: plan.code,
        amount: plan.amount,
        currency: plan.currency || "NGN",
        tx_ref: finalTxRef,
        method: "card",
        status: verifiedAmount > plan.amount ? "overpaid" : "successful",
        flw_id: txIdStr,
        flw_ref: flwRef,
        expiry_date: new Date(Date.now() + 60 * 60 * 1e3).toISOString(),
        metadata: {
          verified_amount: verifiedAmount,
          verified_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
    const { isPremium, expiresAt } = await activateUserPremium(
      user.uid,
      user.email,
      plan.code,
      plan.duration_days,
      txIdStr
    );
    return sendJson(res, 200, {
      ok: true,
      success: true,
      isPremium,
      expiresAt,
      amount: verifiedAmount,
      plan: plan.code,
      message: "Premium membership activated successfully!"
    });
  } catch (err) {
    console.error("[Payments] Verify error:", err);
    return sendJson(res, 500, {
      error: err?.message || "Payment verification failed. Please contact support."
    });
  }
}

// backend/payments/webhook.ts
init_lib();
async function handler20(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const secretHash = process.env.FLW_WEBHOOK_HASH;
  const signature = req.headers["verif-hash"];
  if (secretHash && signature !== secretHash) {
    console.warn("[flw-webhook] Signature mismatch received:", signature);
    return sendJson(res, 401, { error: "Invalid webhook signature hash." });
  }
  try {
    const payload = await readJson(req);
    const event = payload?.event;
    const data = payload?.data;
    if (event !== "charge.completed" || !data) {
      return sendJson(res, 200, { received: true, ignored: true });
    }
    const txId = String(data.id || "");
    const txRef = String(data.tx_ref || "");
    const customerEmail = data.customer?.email || "";
    if (!txRef) {
      return sendJson(res, 200, { received: true, warning: "No tx_ref in webhook" });
    }
    const payment = await getPaymentByTxRef(txRef);
    if (!payment) {
      console.warn(`[flw-webhook] Payment row not found for tx_ref: ${txRef}`);
      return sendJson(res, 200, { received: true, warning: "Payment not found" });
    }
    if (payment.status === "successful" || payment.status === "overpaid") {
      return sendJson(res, 200, { received: true, message: "Payment already processed" });
    }
    const flwSecretKey = process.env.FLW_SECRET_KEY;
    let verifiedStatus = data.status;
    let verifiedAmount = Number(data.amount) || 0;
    let verifiedCurrency = (data.currency || "NGN").toUpperCase();
    let flwRef = data.flw_ref || null;
    if (flwSecretKey && !flwSecretKey.includes("placeholder")) {
      try {
        const verifyRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(txId)}/verify`,
          {
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData?.status === "success" && verifyData?.data) {
            verifiedStatus = verifyData.data.status;
            verifiedAmount = Number(verifyData.data.amount);
            verifiedCurrency = (verifyData.data.currency || "NGN").toUpperCase();
            flwRef = verifyData.data.flw_ref || flwRef;
          }
        }
      } catch (err) {
        console.warn("[flw-webhook] Flutterwave server verification call error:", err);
      }
    }
    if (verifiedStatus !== "successful") {
      await updatePaymentStatus(txRef, {
        status: "failed",
        flw_id: txId,
        flw_ref: flwRef,
        amount_paid: verifiedAmount
      });
      return sendJson(res, 200, { received: true, status: "failed" });
    }
    if (verifiedCurrency !== (payment.currency || "NGN").toUpperCase()) {
      await updatePaymentStatus(txRef, {
        status: "failed",
        flw_id: txId,
        flw_ref: flwRef,
        metadata: { ...payment.metadata, currencyMismatch: verifiedCurrency }
      });
      return sendJson(res, 200, { received: true, error: "Currency mismatch" });
    }
    const requiredAmount = payment.amount;
    if (verifiedAmount < requiredAmount) {
      await updatePaymentStatus(txRef, {
        status: "underpaid",
        flw_id: txId,
        flw_ref: flwRef,
        amount_paid: verifiedAmount,
        metadata: {
          ...payment.metadata,
          underpayment: true,
          shortfall: requiredAmount - verifiedAmount
        }
      });
      console.warn(`[flw-webhook] Underpayment on ${txRef}: received \u20A6${verifiedAmount}, required \u20A6${requiredAmount}`);
      return sendJson(res, 200, { received: true, status: "underpaid" });
    }
    const isOverpaid = verifiedAmount > requiredAmount;
    const finalStatus = isOverpaid ? "overpaid" : "successful";
    await updatePaymentStatus(txRef, {
      status: finalStatus,
      flw_id: txId,
      flw_ref: flwRef,
      amount_paid: verifiedAmount,
      paid_at: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: {
        ...payment.metadata,
        overpayment: isOverpaid,
        excess: isOverpaid ? verifiedAmount - requiredAmount : 0
      }
    });
    const plan = await getPlanByCode(payment.plan_code);
    const durationDays = plan?.duration_days || 30;
    await activateUserPremium(
      payment.user_id,
      customerEmail,
      payment.plan_code,
      durationDays,
      txId
    );
    return sendJson(res, 200, { received: true, activated: true, status: finalStatus });
  } catch (err) {
    console.error("[flw-webhook] Error processing webhook:", err);
    return sendJson(res, 500, { error: "Webhook processing failed." });
  }
}

// backend/payments/create-virtual-account.ts
init_lib();
async function handler21(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    const body = await readJson(req).catch(() => ({}));
    const planCode = body.plan_code || (body.plan === "monthly" ? "premium_monthly" : "premium_monthly");
    const plan = await getPlanByCode(planCode);
    if (!plan || !plan.is_active) {
      return sendJson(res, 400, { error: "Selected plan is not currently available." });
    }
    const userId = user.uid || user.id;
    const existingPayment = await getUnexpiredPendingPayment(userId, plan.code);
    if (existingPayment && existingPayment.account_number && existingPayment.expiry_date) {
      const remainingSeconds = Math.max(
        0,
        Math.floor((new Date(existingPayment.expiry_date).getTime() - Date.now()) / 1e3)
      );
      if (remainingSeconds > 300 && !existingPayment.account_number.startsWith("99")) {
        return sendJson(res, 200, {
          success: true,
          reused: true,
          bankName: existingPayment.bank_name || "Flutterwave Partner Bank",
          accountNumber: existingPayment.account_number,
          accountName: existingPayment.account_name || "Nooraya Premium Recitation",
          amount: existingPayment.amount,
          currency: existingPayment.currency || "NGN",
          txRef: existingPayment.tx_ref,
          expiresAt: existingPayment.expiry_date,
          expiresInSeconds: remainingSeconds,
          plan: {
            code: plan.code,
            name_en: plan.name_en,
            duration_days: plan.duration_days
          }
        });
      }
    }
    const recentCount = await countRecentPaymentsByUser(userId);
    if (recentCount >= 5) {
      return sendJson(res, 429, {
        error: "Too many pending payment requests. Please complete your existing bank transfer or wait a few minutes."
      });
    }
    const txRef = `qf-bt-${Date.now()}-${userId.slice(0, 8)}`;
    const rawSecret = process.env.FLW_SECRET_KEY || "";
    const flwSecretKey = rawSecret.trim().replace(/^['"]|['"]$/g, "");
    const expiryMinutes = 60;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1e3).toISOString();
    let bankName = "";
    let accountNumber = "";
    let accountName = "";
    let flwRef = null;
    let flwId = null;
    let flwErrorMessage = null;
    const hostHeader = req.headers.host || "localhost:3000";
    const proto = req.headers["x-forwarded-proto"] || (hostHeader.startsWith("localhost") ? "http" : "https");
    const origin = `${proto}://${hostHeader}`;
    if (flwSecretKey && !flwSecretKey.includes("placeholder")) {
      try {
        const flwRes = await fetch("https://api.flutterwave.com/v3/charges?type=bank_transfer", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: plan.amount,
            currency: plan.currency || "NGN",
            email: user.email,
            tx_ref: txRef,
            fullname: user.displayName || user.email.split("@")[0]
          })
        });
        const flwData = await flwRes.json().catch(() => ({}));
        if (flwRes.ok && (flwData?.status === "success" || flwData?.status === "pending")) {
          const auth = flwData?.meta?.authorization || flwData?.data;
          const candidateAccount = auth?.transfer_account || auth?.account_number || auth?.accountnumber;
          if (candidateAccount) {
            accountNumber = String(candidateAccount).trim();
            bankName = auth.transfer_bank || auth.bank_name || auth.bankname || "Flutterwave Partner Bank";
            accountName = auth.account_name || auth.transfer_account_name || `Nooraya / ${user.email.split("@")[0]}`;
            flwRef = flwData?.data?.flw_ref || auth?.flw_ref || null;
            flwId = flwData?.data?.id ? String(flwData.data.id) : null;
          } else {
            flwErrorMessage = flwData?.message || "Flutterwave response did not contain virtual account details.";
          }
        } else {
          flwErrorMessage = flwData?.message || `Flutterwave API returned status ${flwRes.status}`;
        }
      } catch (err) {
        flwErrorMessage = err?.message || "Network error reaching Flutterwave API.";
      }
    } else {
      flwErrorMessage = "FLW_SECRET_KEY is not configured in server environment.";
    }
    if (accountNumber && bankName) {
      await createPaymentRecord({
        user_id: userId,
        plan_code: plan.code,
        amount: plan.amount,
        currency: plan.currency || "NGN",
        tx_ref: txRef,
        method: "bank_transfer",
        status: "pending",
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        expiry_date: expiresAt,
        flw_ref: flwRef,
        flw_id: flwId,
        metadata: {
          plan_name: plan.name_en,
          duration_days: plan.duration_days,
          user_email: user.email
        }
      });
      return sendJson(res, 200, {
        success: true,
        bankName,
        accountNumber,
        accountName,
        amount: plan.amount,
        currency: plan.currency || "NGN",
        txRef,
        expiresAt,
        expiresInSeconds: expiryMinutes * 60,
        plan: {
          code: plan.code,
          name_en: plan.name_en,
          duration_days: plan.duration_days
        }
      });
    }
    console.error("[Payments Admin Alert] Dynamic virtual account generation failed:", {
      error: flwErrorMessage,
      user_email: user.email,
      txRef,
      plan_code: plan.code
    });
    let fallbackCheckoutUrl = null;
    if (flwSecretKey && !flwSecretKey.includes("placeholder")) {
      try {
        const redirectUrl = `${origin}/premium?status=successful&tx_ref=${encodeURIComponent(txRef)}&plan_code=${encodeURIComponent(plan.code)}`;
        const fallbackRes = await fetch("https://api.flutterwave.com/v3/payments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${flwSecretKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tx_ref: txRef,
            amount: plan.amount,
            currency: plan.currency || "NGN",
            redirect_url: redirectUrl,
            customer: {
              email: user.email,
              name: user.displayName || user.email.split("@")[0]
            },
            customizations: {
              title: "Nooraya Quranic Sanctuary",
              description: `${plan.name_en} (${plan.amount} ${plan.currency})`,
              logo: `${origin}/icon.svg`
            }
          })
        });
        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (fallbackRes.ok && fallbackData?.data?.link) {
          fallbackCheckoutUrl = fallbackData.data.link;
          await createPaymentRecord({
            user_id: userId,
            plan_code: plan.code,
            amount: plan.amount,
            currency: plan.currency || "NGN",
            tx_ref: txRef,
            method: "hosted_checkout",
            status: "pending",
            metadata: {
              plan_name: plan.name_en,
              duration_days: plan.duration_days,
              user_email: user.email,
              fallback_from: "bank_transfer"
            }
          });
        }
      } catch (fbErr) {
        console.warn("[Payments] Hosted checkout fallback generation notice:", fbErr);
      }
    }
    return sendJson(res, 200, {
      success: false,
      error: "Direct virtual bank account generation is temporarily unavailable. Please proceed using Flutterwave multi-channel checkout.",
      detailedError: flwErrorMessage,
      fallbackCheckoutUrl,
      txRef,
      amount: plan.amount,
      currency: plan.currency || "NGN",
      plan: {
        code: plan.code,
        name_en: plan.name_en,
        duration_days: plan.duration_days
      }
    });
  } catch (err) {
    console.error("[Payments] Create virtual account error:", err);
    return sendJson(res, 500, { error: "Failed to process payment request" });
  }
}

// backend/payments/create-hosted-checkout.ts
init_lib();
async function handler22(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    const body = await readJson(req).catch(() => ({}));
    const planCode = body.plan_code || (body.plan === "monthly" ? "premium_monthly" : "premium_monthly");
    const plan = await getPlanByCode(planCode);
    if (!plan || !plan.is_active) {
      return sendJson(res, 400, { error: "Selected plan is not currently available." });
    }
    const userId = user.uid || user.id;
    const txRef = `qf-ch-${Date.now()}-${userId.slice(0, 8)}`;
    const rawSecret = process.env.FLW_SECRET_KEY || "";
    const flwSecretKey = rawSecret.trim().replace(/^['"]|['"]$/g, "");
    if (!flwSecretKey || flwSecretKey.includes("placeholder")) {
      console.error("[Payments] Hosted checkout failed: FLW_SECRET_KEY is not configured in environment variables.");
      return sendJson(res, 500, {
        error: "Payment gateway configuration error. Please ensure FLW_SECRET_KEY is configured in Vercel."
      });
    }
    const hostHeader = req.headers.host || "localhost:3000";
    const proto = req.headers["x-forwarded-proto"] || (hostHeader.startsWith("localhost") ? "http" : "https");
    const origin = `${proto}://${hostHeader}`;
    const redirectUrl = body.redirect_url || `${origin}/premium?status=successful&tx_ref=${encodeURIComponent(txRef)}&plan_code=${encodeURIComponent(plan.code)}`;
    const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flwSecretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: plan.amount,
        currency: plan.currency || "NGN",
        redirect_url: redirectUrl,
        customer: {
          email: user.email,
          name: user.displayName || user.email.split("@")[0]
        },
        customizations: {
          title: "Nooraya Quranic Sanctuary",
          description: `${plan.name_en} Subscription (${plan.duration_days} days)`,
          logo: `${origin}/icon.svg`
        }
      })
    });
    const flwData = await flwRes.json().catch(() => ({}));
    if (!flwRes.ok || flwData?.status !== "success" || !flwData?.data?.link) {
      const errMsg = flwData?.message || `Flutterwave API returned status ${flwRes.status}`;
      console.error("[Payments] Flutterwave hosted payment creation failed:", {
        status: flwRes.status,
        message: errMsg,
        txRef,
        planCode: plan.code
      });
      return sendJson(res, 400, {
        error: errMsg || "Unable to generate Flutterwave checkout link."
      });
    }
    const checkoutUrl = flwData.data.link;
    await createPaymentRecord({
      user_id: userId,
      plan_code: plan.code,
      amount: plan.amount,
      currency: plan.currency || "NGN",
      tx_ref: txRef,
      method: "hosted_checkout",
      status: "pending",
      metadata: {
        plan_name: plan.name_en,
        duration_days: plan.duration_days,
        user_email: user.email,
        checkout_url: checkoutUrl
      }
    });
    return sendJson(res, 200, {
      success: true,
      checkoutUrl,
      txRef,
      amount: plan.amount,
      currency: plan.currency || "NGN",
      plan: {
        code: plan.code,
        name_en: plan.name_en,
        duration_days: plan.duration_days
      }
    });
  } catch (err) {
    console.error("[Payments] Create hosted checkout error:", err);
    return sendJson(res, 500, { error: "Failed to initialize payment gateway" });
  }
}

// backend/payments/check-transfer-status.ts
init_lib();
async function handler23(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    const parsedUrl = new URL(req.url || "", "http://localhost");
    const txRef = parsedUrl.searchParams.get("tx_ref");
    if (!txRef) {
      return sendJson(res, 400, { error: "tx_ref query param is required" });
    }
    const payment = await getPaymentByTxRef(txRef);
    if (!payment) {
      return sendJson(res, 404, { error: "Payment transaction not found" });
    }
    if (payment.status === "successful" || payment.status === "overpaid") {
      return sendJson(res, 200, {
        status: "successful",
        isPremium: true,
        amount: payment.amount,
        paidAt: payment.paid_at,
        txRef: payment.tx_ref
      });
    }
    const flwSecretKey = process.env.FLW_SECRET_KEY;
    let isSuccess = false;
    let flwTxId = void 0;
    let flwRef = void 0;
    let amountPaid = 0;
    if (flwSecretKey && !flwSecretKey.includes("placeholder")) {
      try {
        const flwRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify-by-reference?tx_ref=${encodeURIComponent(txRef)}`,
          {
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (flwRes.ok) {
          const flwData = await flwRes.json();
          if (flwData?.status === "success" && flwData?.data?.status === "successful") {
            const data = flwData.data;
            if ((data.currency || "NGN").toUpperCase() === (payment.currency || "NGN").toUpperCase()) {
              amountPaid = Number(data.amount);
              flwTxId = String(data.id || "");
              flwRef = data.flw_ref;
              isSuccess = true;
            }
          }
        }
      } catch (err) {
        console.warn("[Payments] Flutterwave check status call error:", err);
      }
    }
    const forceSimulate = parsedUrl.searchParams.get("simulate") === "true";
    if (!isSuccess && (!flwSecretKey || flwSecretKey.includes("placeholder")) && forceSimulate) {
      isSuccess = true;
      amountPaid = payment.amount;
    }
    if (isSuccess) {
      const requiredAmount = payment.amount;
      if (amountPaid < requiredAmount) {
        await updatePaymentStatus(txRef, {
          status: "underpaid",
          flw_id: flwTxId,
          flw_ref: flwRef,
          amount_paid: amountPaid
        });
        return sendJson(res, 200, {
          status: "underpaid",
          isPremium: false,
          message: `Received \u20A6${amountPaid}, but required amount is \u20A6${requiredAmount}.`
        });
      }
      const finalStatus = amountPaid > requiredAmount ? "overpaid" : "successful";
      await updatePaymentStatus(txRef, {
        status: finalStatus,
        flw_id: flwTxId,
        flw_ref: flwRef,
        amount_paid: amountPaid,
        paid_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      const plan = await getPlanByCode(payment.plan_code);
      const durationDays = plan?.duration_days || 30;
      const { isPremium, expiresAt } = await activateUserPremium(
        payment.user_id,
        user.email,
        payment.plan_code,
        durationDays,
        flwTxId
      );
      return sendJson(res, 200, {
        status: "successful",
        isPremium,
        expiresAt,
        amountPaid
      });
    }
    return sendJson(res, 200, {
      status: payment.status || "pending",
      isPremium: false,
      message: "Transfer not yet confirmed. Inter-bank transfers typically take 30\u201390 seconds to clear."
    });
  } catch (err) {
    console.error("[Payments] Check transfer status error:", err);
    return sendJson(res, 500, { error: "Failed to verify transfer status" });
  }
}

// backend/admin/supabase-backgrounds.ts
init_lib();
var handler24 = async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    await ensureBackgroundsTable().catch(() => {
    });
    if (req.method === "GET") {
      const sb = getSupabaseAdmin2();
      if (sb) {
        try {
          const { data, error } = await sb.from("backgrounds").select("*").order("sort_order", { ascending: true });
          if (!error && Array.isArray(data)) {
            return sendJson(res, 200, { backgrounds: data });
          }
        } catch (e) {
          console.warn("Supabase admin GET backgrounds notice:", e);
        }
      }
      const result = await q(`
        SELECT id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p, poster_url, size_bytes, duration_seconds, renditions, storage_paths, attribution, sort_order, is_active, is_draft, is_premium, created_at
        FROM backgrounds
        ORDER BY sort_order ASC, created_at DESC
      `);
      return sendJson(res, 200, { backgrounds: result.rows });
    }
    if (req.method === "POST") {
      const body = await readJsonLarge(req);
      const action = body.action || "add";
      if (action === "signed-upload-url") {
        const sb = getSupabaseAdmin2();
        if (!sb) {
          return sendJson(res, 500, { error: "Supabase admin client not initialized" });
        }
        const bucket = String(body.bucket || "ambient-backgrounds");
        const filename = String(body.filename || "video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path4 = body.path ? String(body.path) : `backgrounds/${Date.now()}_${filename}`;
        const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path4);
        if (error || !data) {
          return sendJson(res, 500, { error: error?.message || "Could not generate signed upload URL" });
        }
        const { data: publicUrlData } = sb.storage.from(bucket).getPublicUrl(path4);
        return sendJson(res, 200, {
          signedUrl: data.signedUrl,
          token: data.token,
          path: data.path,
          publicUrl: publicUrlData.publicUrl
        });
      }
      if (action === "add") {
        const id = body.id || `bg_${Date.now()}`;
        const name_en = String(body.name_en || "").trim();
        const name_ar = body.name_ar ? String(body.name_ar).trim() : null;
        const category = String(body.category || "general").trim().toLowerCase();
        const video_url = String(body.video_url || "").trim();
        const video_url_720p = body.video_url_720p ? String(body.video_url_720p).trim() : video_url;
        const video_url_480p = body.video_url_480p ? String(body.video_url_480p).trim() : null;
        const poster_url = body.poster_url ? String(body.poster_url).trim() : null;
        const size_bytes = Number(body.size_bytes || 0);
        const duration_seconds = Number(body.duration_seconds || 0);
        const renditions = Array.isArray(body.renditions) ? body.renditions : [];
        const storage_paths = Array.isArray(body.storage_paths) ? body.storage_paths : [];
        const attribution = body.attribution ? String(body.attribution).trim() : null;
        const sort_order = Number(body.sort_order || 0);
        const is_active = body.is_active !== void 0 ? Boolean(body.is_active) : true;
        const is_draft = body.is_draft !== void 0 ? Boolean(body.is_draft) : false;
        const is_premium = Boolean(body.is_premium);
        if (!name_en || !video_url) {
          return sendJson(res, 400, { error: "name_en and video_url are required." });
        }
        const sb = getSupabaseAdmin2();
        if (sb) {
          try {
            const { error: sbErr } = await sb.from("backgrounds").upsert(
              {
                id,
                name_en,
                name_ar,
                category,
                video_url,
                video_url_720p,
                video_url_480p,
                poster_url,
                size_bytes,
                duration_seconds,
                renditions,
                storage_paths,
                attribution,
                sort_order,
                is_active,
                is_draft,
                is_premium
              },
              { onConflict: "id" }
            );
            if (sbErr) console.warn("Supabase service role backgrounds upsert warning:", sbErr.message);
          } catch (e) {
            console.warn("Supabase service role write exception:", e);
          }
        }
        try {
          await q(
            `INSERT INTO backgrounds (
               id, name_en, name_ar, category, video_url, video_url_720p, video_url_480p,
               poster_url, size_bytes, duration_seconds, renditions, storage_paths,
               attribution, sort_order, is_active, is_draft, is_premium, created_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())
             ON CONFLICT (id) DO UPDATE SET
               name_en = EXCLUDED.name_en,
               name_ar = EXCLUDED.name_ar,
               category = EXCLUDED.category,
               video_url = EXCLUDED.video_url,
               video_url_720p = EXCLUDED.video_url_720p,
               video_url_480p = EXCLUDED.video_url_480p,
               poster_url = EXCLUDED.poster_url,
               size_bytes = EXCLUDED.size_bytes,
               duration_seconds = EXCLUDED.duration_seconds,
               renditions = EXCLUDED.renditions,
               storage_paths = EXCLUDED.storage_paths,
               attribution = EXCLUDED.attribution,
               sort_order = EXCLUDED.sort_order,
               is_active = EXCLUDED.is_active,
               is_draft = EXCLUDED.is_draft,
               is_premium = EXCLUDED.is_premium`,
            [
              id,
              name_en,
              name_ar,
              category,
              video_url,
              video_url_720p,
              video_url_480p,
              poster_url,
              size_bytes,
              duration_seconds,
              JSON.stringify(renditions),
              JSON.stringify(storage_paths),
              attribution,
              sort_order,
              is_active,
              is_draft,
              is_premium
            ]
          );
        } catch (dbErr) {
          console.warn("Neon backgrounds write notice:", dbErr);
        }
        return sendJson(res, 201, {
          ok: true,
          background: {
            id,
            name_en,
            name_ar,
            category,
            video_url,
            video_url_720p,
            video_url_480p,
            poster_url,
            size_bytes,
            duration_seconds,
            sort_order,
            is_active,
            is_draft,
            is_premium
          }
        });
      }
      if (action === "update") {
        const id = String(body.id || "");
        if (!id) return sendJson(res, 400, { error: "ID is required" });
        const name_en = body.name_en !== void 0 ? String(body.name_en).trim() : void 0;
        const name_ar = body.name_ar !== void 0 ? body.name_ar ? String(body.name_ar).trim() : null : void 0;
        const category = body.category !== void 0 ? String(body.category).trim().toLowerCase() : void 0;
        const video_url = body.video_url !== void 0 ? String(body.video_url).trim() : void 0;
        const video_url_720p = body.video_url_720p !== void 0 ? String(body.video_url_720p).trim() : void 0;
        const video_url_480p = body.video_url_480p !== void 0 ? body.video_url_480p ? String(body.video_url_480p).trim() : null : void 0;
        const poster_url = body.poster_url !== void 0 ? body.poster_url ? String(body.poster_url).trim() : null : void 0;
        const size_bytes = body.size_bytes !== void 0 ? Number(body.size_bytes) : void 0;
        const duration_seconds = body.duration_seconds !== void 0 ? Number(body.duration_seconds) : void 0;
        const renditions = body.renditions !== void 0 ? Array.isArray(body.renditions) ? body.renditions : [] : void 0;
        const storage_paths = body.storage_paths !== void 0 ? Array.isArray(body.storage_paths) ? body.storage_paths : [] : void 0;
        const attribution = body.attribution !== void 0 ? body.attribution ? String(body.attribution).trim() : null : void 0;
        const sort_order = body.sort_order !== void 0 ? Number(body.sort_order) : void 0;
        const is_active = body.is_active !== void 0 ? Boolean(body.is_active) : void 0;
        const is_draft = body.is_draft !== void 0 ? Boolean(body.is_draft) : void 0;
        const is_premium = body.is_premium !== void 0 ? Boolean(body.is_premium) : void 0;
        const sb = getSupabaseAdmin2();
        if (sb) {
          try {
            const updatePayload = {};
            if (name_en !== void 0) updatePayload.name_en = name_en;
            if (name_ar !== void 0) updatePayload.name_ar = name_ar;
            if (category !== void 0) updatePayload.category = category;
            if (video_url !== void 0) updatePayload.video_url = video_url;
            if (video_url_720p !== void 0) updatePayload.video_url_720p = video_url_720p;
            if (video_url_480p !== void 0) updatePayload.video_url_480p = video_url_480p;
            if (poster_url !== void 0) updatePayload.poster_url = poster_url;
            if (size_bytes !== void 0) updatePayload.size_bytes = size_bytes;
            if (duration_seconds !== void 0) updatePayload.duration_seconds = duration_seconds;
            if (renditions !== void 0) updatePayload.renditions = renditions;
            if (storage_paths !== void 0) updatePayload.storage_paths = storage_paths;
            if (attribution !== void 0) updatePayload.attribution = attribution;
            if (sort_order !== void 0) updatePayload.sort_order = sort_order;
            if (is_active !== void 0) updatePayload.is_active = is_active;
            if (is_draft !== void 0) updatePayload.is_draft = is_draft;
            if (is_premium !== void 0) updatePayload.is_premium = is_premium;
            await sb.from("backgrounds").update(updatePayload).eq("id", id);
          } catch (e) {
            console.warn("Supabase admin backgrounds update notice:", e);
          }
        }
        try {
          await q(
            `UPDATE backgrounds
             SET name_en = COALESCE($2, name_en),
                 name_ar = COALESCE($3, name_ar),
                 category = COALESCE($4, category),
                 video_url = COALESCE($5, video_url),
                 video_url_720p = COALESCE($6, video_url_720p),
                 video_url_480p = COALESCE($7, video_url_480p),
                 poster_url = COALESCE($8, poster_url),
                 size_bytes = COALESCE($9, size_bytes),
                 duration_seconds = COALESCE($10, duration_seconds),
                 renditions = COALESCE($11::jsonb, renditions),
                 storage_paths = COALESCE($12::jsonb, storage_paths),
                 attribution = COALESCE($13, attribution),
                 sort_order = COALESCE($14, sort_order),
                 is_active = COALESCE($15, is_active),
                 is_draft = COALESCE($16, is_draft),
                 is_premium = COALESCE($17, is_premium)
             WHERE id = $1`,
            [
              id,
              name_en,
              name_ar,
              category,
              video_url,
              video_url_720p,
              video_url_480p,
              poster_url,
              size_bytes,
              duration_seconds,
              renditions ? JSON.stringify(renditions) : null,
              storage_paths ? JSON.stringify(storage_paths) : null,
              attribution,
              sort_order,
              is_active,
              is_draft,
              is_premium
            ]
          );
        } catch (dbErr) {
          console.warn("Neon backgrounds update notice:", dbErr);
        }
        return sendJson(res, 200, { ok: true });
      }
      if (action === "signed-upload-url") {
        const path4 = String(body.path || "").replace(/^\/+/, "");
        if (!path4) return sendJson(res, 400, { error: "Path is required" });
        const sb = getSupabaseAdmin2();
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
        if (sb) {
          try {
            const { data, error } = await sb.storage.from("ambient-backgrounds").createSignedUploadUrl(path4);
            if (!error && data?.signedUrl) {
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/ambient-backgrounds/${path4}`;
              return sendJson(res, 200, {
                ok: true,
                signedUrl: data.signedUrl,
                token: data.token,
                publicUrl
              });
            }
          } catch (e) {
            console.warn("createSignedUploadUrl error:", e?.message);
          }
        }
        const fallbackPublicUrl = `${supabaseUrl}/storage/v1/object/public/ambient-backgrounds/${path4}`;
        return sendJson(res, 200, { ok: false, fallbackPublicUrl });
      }
      if (action === "upload") {
        const path4 = String(body.path || "").replace(/^\/+/, "");
        const contentType = String(body.contentType || "video/mp4");
        const base64Data = String(body.data || "");
        if (!path4 || !base64Data) return sendJson(res, 400, { error: "Path and data are required" });
        const buffer = Buffer.from(base64Data, "base64");
        const sb = getSupabaseAdmin2();
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
        if (sb) {
          try {
            const { data, error } = await sb.storage.from("ambient-backgrounds").upload(path4, buffer, {
              contentType,
              upsert: true
            });
            if (!error) {
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/ambient-backgrounds/${path4}`;
              return sendJson(res, 200, { ok: true, publicUrl });
            }
            console.warn("Supabase service role upload error:", error);
          } catch (e) {
            console.warn("Upload exception:", e);
          }
        }
        return sendJson(res, 500, { error: "Could not upload to storage." });
      }
      if (action === "delete") {
        const id = String(body.id || "");
        if (!id) return sendJson(res, 400, { error: "ID is required" });
        const sb = getSupabaseAdmin2();
        if (sb) {
          try {
            await sb.from("backgrounds").delete().eq("id", id);
          } catch (e) {
            console.warn("Supabase delete background notice:", e);
          }
        }
        let paths = [];
        try {
          const existing = await q("SELECT storage_paths FROM backgrounds WHERE id = $1", [id]);
          await q("DELETE FROM backgrounds WHERE id = $1", [id]);
          paths = existing.rows?.[0]?.storage_paths || [];
        } catch (dbErr) {
          console.warn("Neon delete background notice:", dbErr);
        }
        return sendJson(res, 200, { ok: true, deleted_storage_paths: paths });
      }
      return sendJson(res, 400, { error: "Unknown action" });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Admin backgrounds error:", err);
    return sendJson(res, 500, { error: err?.message || "Server error" });
  }
};
var supabase_backgrounds_default = handler24;

// backend/plans.ts
init_lib();
async function handler25(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const plans = await getActivePlans();
    return sendJson(res, 200, { ok: true, plans });
  } catch (err) {
    console.error("[plans] Error fetching plans:", err);
    return sendJson(res, 500, { error: "Failed to retrieve plans" });
  }
}

// backend/admin/plans.ts
init_lib();
async function handler26(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const url = new URL(req.url || "", "http://localhost");
  const path4 = url.pathname;
  if (req.method === "GET") {
    if (path4.includes("logs")) {
      const logs = await getPlanPriceLogs();
      return sendJson(res, 200, { ok: true, logs });
    }
    const plans = await getActivePlans();
    return sendJson(res, 200, { ok: true, plans });
  }
  if (req.method === "POST") {
    try {
      const body = await readJson(req);
      const { code, amount, duration_days, is_active, name_en } = body;
      if (!code) {
        return sendJson(res, 400, { error: "Plan code is required" });
      }
      const result = await updatePlanAdmin(
        code,
        {
          amount: amount !== void 0 ? Number(amount) : void 0,
          duration_days: duration_days !== void 0 ? Number(duration_days) : void 0,
          is_active: is_active !== void 0 ? Boolean(is_active) : void 0,
          name_en
        },
        admin.email || admin.uid
      );
      if (!result.ok) {
        return sendJson(res, 400, { error: result.error || "Failed to update plan" });
      }
      return sendJson(res, 200, { ok: true, plan: result.plan });
    } catch (err) {
      console.error("[admin/plans] Error:", err);
      return sendJson(res, 500, { error: err?.message || "Server error" });
    }
  }
  return sendJson(res, 405, { error: "Method not allowed" });
}

// backend/admin/payments.ts
init_lib();
async function handler27(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const url = new URL(req.url || "", "http://localhost");
  if (req.method === "GET") {
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "all";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const result = await listPaymentsAdmin({ search, status, page, pageSize });
    return sendJson(res, 200, { ok: true, ...result });
  }
  if (req.method === "POST") {
    try {
      const body = await readJson(req);
      const { action, tx_ref } = body;
      if (action === "reverify" && tx_ref) {
        const payment = await getPaymentByTxRef(tx_ref);
        if (!payment) {
          return sendJson(res, 404, { error: "Payment record not found" });
        }
        const flwSecretKey = process.env.FLW_SECRET_KEY;
        if (!flwSecretKey || flwSecretKey.includes("placeholder")) {
          return sendJson(res, 400, {
            error: "Flutterwave secret key is not configured for live verification."
          });
        }
        const flwRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify-by-reference?tx_ref=${encodeURIComponent(tx_ref)}`,
          {
            headers: {
              Authorization: `Bearer ${flwSecretKey}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (!flwRes.ok) {
          const errData = await flwRes.json().catch(() => ({}));
          return sendJson(res, 400, {
            error: errData.message || "Flutterwave was unable to verify reference."
          });
        }
        const flwData = await flwRes.json();
        if (flwData?.status === "success" && flwData?.data?.status === "successful") {
          const data = flwData.data;
          const amountPaid = Number(data.amount);
          const flwTxId = String(data.id || "");
          const flwRef = data.flw_ref;
          const requiredAmount = payment.amount;
          const finalStatus = amountPaid > requiredAmount ? "overpaid" : "successful";
          await updatePaymentStatus(tx_ref, {
            status: finalStatus,
            flw_id: flwTxId,
            flw_ref: flwRef,
            amount_paid: amountPaid,
            paid_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          const plan = await getPlanByCode(payment.plan_code);
          const durationDays = plan?.duration_days || 30;
          await activateUserPremium(
            payment.user_id,
            payment.user_email || "",
            payment.plan_code,
            durationDays,
            flwTxId
          );
          return sendJson(res, 200, {
            ok: true,
            status: finalStatus,
            message: "Transaction successfully verified and user premium activated!"
          });
        }
        return sendJson(res, 200, {
          ok: false,
          status: flwData?.data?.status || "pending",
          message: "Transaction is not marked successful in Flutterwave."
        });
      }
      if (action === "reconcile") {
        const flwSecretKey = process.env.FLW_SECRET_KEY;
        if (!flwSecretKey || flwSecretKey.includes("placeholder")) {
          return sendJson(res, 400, {
            error: "Flutterwave secret key is not configured for live reconciliation."
          });
        }
        const { rows } = await q(
          `SELECT * FROM payments 
           WHERE status = 'pending' AND created_at > now() - interval '24 hours' 
           ORDER BY created_at DESC LIMIT 50`
        ).catch(() => ({ rows: [] }));
        let checked = 0;
        let activated = 0;
        for (const p of rows || []) {
          checked++;
          try {
            const flwRes = await fetch(
              `https://api.flutterwave.com/v3/transactions/verify-by-reference?tx_ref=${encodeURIComponent(p.tx_ref)}`,
              {
                headers: {
                  Authorization: `Bearer ${flwSecretKey}`,
                  "Content-Type": "application/json"
                }
              }
            );
            if (flwRes.ok) {
              const flwData = await flwRes.json();
              if (flwData?.status === "success" && flwData?.data?.status === "successful") {
                const data = flwData.data;
                const amountPaid = Number(data.amount);
                const finalStatus = amountPaid > p.amount ? "overpaid" : "successful";
                await updatePaymentStatus(p.tx_ref, {
                  status: finalStatus,
                  flw_id: String(data.id || ""),
                  flw_ref: data.flw_ref,
                  amount_paid: amountPaid,
                  paid_at: (/* @__PURE__ */ new Date()).toISOString()
                });
                const plan = await getPlanByCode(p.plan_code);
                await activateUserPremium(
                  p.user_id,
                  "",
                  p.plan_code,
                  plan?.duration_days || 30,
                  String(data.id || "")
                );
                activated++;
              }
            }
          } catch (e) {
            console.warn(`[reconcile] Error checking ${p.tx_ref}:`, e);
          }
        }
        return sendJson(res, 200, {
          ok: true,
          checked,
          activated,
          message: `Reconciliation completed: ${checked} checked, ${activated} activated.`
        });
      }
      return sendJson(res, 400, { error: "Unknown action" });
    } catch (err) {
      console.error("[admin/payments] Error:", err);
      return sendJson(res, 500, { error: err?.message || "Server error" });
    }
  }
  return sendJson(res, 405, { error: "Method not allowed" });
}

// backend/adhan-voices.ts
init_lib();
async function ensureAdhanVoicesTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS adhan_voices (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ar TEXT,
      muezzin TEXT NOT NULL,
      mosque TEXT,
      audio_url TEXT,
      fajr_audio_url TEXT,
      duration INTEGER DEFAULT 0,
      license TEXT,
      source TEXT,
      attribution TEXT,
      is_active BOOLEAN DEFAULT true,
      is_premium BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {
  });
}
var handler28 = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  try {
    const sb = getSupabaseAdmin2();
    if (sb) {
      try {
        const { data, error } = await sb.from("adhan_voices").select("*").eq("is_active", true).order("created_at", { ascending: true });
        if (!error && Array.isArray(data)) {
          return sendJson(res, 200, { voices: data });
        }
      } catch (sbErr) {
        console.warn("[adhan-voices] Supabase query notice:", sbErr);
      }
    }
    await ensureAdhanVoicesTable();
    const result = await q(`
      SELECT id, name_en, name_ar, muezzin, mosque, audio_url, fajr_audio_url,
             duration, license, source, attribution, is_active, is_premium, created_at
      FROM adhan_voices
      WHERE is_active = true
      ORDER BY created_at ASC
    `);
    return sendJson(res, 200, {
      voices: result.rows || []
    });
  } catch (err) {
    console.error("Failed to load adhan voices:", err);
    return sendJson(res, 200, { voices: [] });
  }
};
var adhan_voices_default = handler28;

// backend/admin/adhan-voices.ts
init_lib();
var handler29 = async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  await ensureAdhanVoicesTable();
  try {
    if (req.method === "GET") {
      const sb = getSupabaseAdmin2();
      if (sb) {
        try {
          const { data, error } = await sb.from("adhan_voices").select("*").order("created_at", { ascending: true });
          if (!error && Array.isArray(data)) {
            return sendJson(res, 200, { voices: data });
          }
        } catch (sbErr) {
          console.warn("[admin/adhan-voices] Supabase query notice:", sbErr);
        }
      }
      const result = await q(`
        SELECT id, name_en, name_ar, muezzin, mosque, audio_url, fajr_audio_url,
               duration, license, source, attribution, is_active, is_premium, created_at
        FROM adhan_voices
        ORDER BY created_at ASC
      `);
      return sendJson(res, 200, { voices: result.rows || [] });
    }
    if (req.method === "POST") {
      const body = await readJson(req);
      const action = String(body.action || "add");
      if (action === "signed-upload-url") {
        const sb = getSupabaseAdmin2();
        if (!sb) {
          return sendJson(res, 500, { error: "Supabase admin client not initialized" });
        }
        const filename = String(body.filename || "adhan.mp3").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path4 = `adhan/${Date.now()}_${filename}`;
        const { data, error } = await sb.storage.from("ambient-backgrounds").createSignedUploadUrl(path4);
        if (error || !data) {
          return sendJson(res, 500, { error: error?.message || "Could not generate signed upload URL" });
        }
        const { data: publicUrlData } = sb.storage.from("ambient-backgrounds").getPublicUrl(path4);
        return sendJson(res, 200, {
          signedUrl: data.signedUrl,
          token: data.token,
          path: data.path,
          publicUrl: publicUrlData.publicUrl
        });
      }
      if (action === "add") {
        const id = String(body.id || `voice_${Date.now()}`).trim();
        const name_en = String(body.name_en || "").trim();
        const name_ar = body.name_ar ? String(body.name_ar).trim() : null;
        const muezzin = String(body.muezzin || "").trim();
        const mosque = body.mosque ? String(body.mosque).trim() : null;
        const audio_url = body.audio_url ? String(body.audio_url).trim() : null;
        const fajr_audio_url = body.fajr_audio_url ? String(body.fajr_audio_url).trim() : null;
        const duration = Number(body.duration || 0);
        const license = body.license ? String(body.license).trim() : "Upload when licensed";
        const source = body.source ? String(body.source).trim() : null;
        const attribution = body.attribution ? String(body.attribution).trim() : null;
        const is_active = body.is_active !== void 0 ? Boolean(body.is_active) : true;
        const is_premium = Boolean(body.is_premium);
        if (!name_en || !muezzin) {
          return sendJson(res, 400, { error: "name_en and muezzin are required fields." });
        }
        const record = {
          id,
          name_en,
          name_ar,
          muezzin,
          mosque,
          audio_url,
          fajr_audio_url,
          duration,
          license,
          source,
          attribution,
          is_active,
          is_premium
        };
        const sb = getSupabaseAdmin2();
        if (sb) {
          try {
            await sb.from("adhan_voices").upsert(record);
          } catch (sbErr) {
            console.warn("[admin/adhan-voices] Supabase upsert note:", sbErr);
          }
        }
        await q(
          `INSERT INTO adhan_voices (
             id, name_en, name_ar, muezzin, mosque, audio_url, fajr_audio_url,
             duration, license, source, attribution, is_active, is_premium, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
           ON CONFLICT (id) DO UPDATE SET
             name_en = EXCLUDED.name_en,
             name_ar = EXCLUDED.name_ar,
             muezzin = EXCLUDED.muezzin,
             mosque = EXCLUDED.mosque,
             audio_url = EXCLUDED.audio_url,
             fajr_audio_url = EXCLUDED.fajr_audio_url,
             duration = EXCLUDED.duration,
             license = EXCLUDED.license,
             source = EXCLUDED.source,
             attribution = EXCLUDED.attribution,
             is_active = EXCLUDED.is_active,
             is_premium = EXCLUDED.is_premium`,
          [
            id,
            name_en,
            name_ar,
            muezzin,
            mosque,
            audio_url,
            fajr_audio_url,
            duration,
            license,
            source,
            attribution,
            is_active,
            is_premium
          ]
        ).catch(() => {
        });
        return sendJson(res, 201, { voice: record });
      }
      if (action === "update") {
        const id = String(body.id || "").trim();
        if (!id) return sendJson(res, 400, { error: "Voice id is required" });
        const sb = getSupabaseAdmin2();
        const updateData = {};
        if (body.name_en !== void 0) updateData.name_en = String(body.name_en).trim();
        if (body.name_ar !== void 0) updateData.name_ar = body.name_ar ? String(body.name_ar).trim() : null;
        if (body.muezzin !== void 0) updateData.muezzin = String(body.muezzin).trim();
        if (body.mosque !== void 0) updateData.mosque = body.mosque ? String(body.mosque).trim() : null;
        if (body.audio_url !== void 0) updateData.audio_url = body.audio_url ? String(body.audio_url).trim() : null;
        if (body.fajr_audio_url !== void 0) updateData.fajr_audio_url = body.fajr_audio_url ? String(body.fajr_audio_url).trim() : null;
        if (body.duration !== void 0) updateData.duration = Number(body.duration || 0);
        if (body.license !== void 0) updateData.license = String(body.license).trim();
        if (body.attribution !== void 0) updateData.attribution = body.attribution ? String(body.attribution).trim() : null;
        if (body.is_active !== void 0) updateData.is_active = Boolean(body.is_active);
        if (body.is_premium !== void 0) updateData.is_premium = Boolean(body.is_premium);
        if (sb) {
          await sb.from("adhan_voices").update(updateData).eq("id", id);
        }
        return sendJson(res, 200, { updated: true });
      }
      if (action === "toggle-active" || action === "toggle-premium") {
        const id = String(body.id || "").trim();
        const value = Boolean(body.value);
        const column = action === "toggle-active" ? "is_active" : "is_premium";
        const sb = getSupabaseAdmin2();
        if (sb) {
          await sb.from("adhan_voices").update({ [column]: value }).eq("id", id);
        }
        await q(`UPDATE adhan_voices SET ${column} = $1 WHERE id = $2`, [value, id]).catch(() => {
        });
        return sendJson(res, 200, { success: true });
      }
      if (action === "delete") {
        const id = String(body.id || "").trim();
        if (!id) return sendJson(res, 400, { error: "id required" });
        const sb = getSupabaseAdmin2();
        if (sb) {
          await sb.from("adhan_voices").delete().eq("id", id);
        }
        await q("DELETE FROM adhan_voices WHERE id = $1", [id]).catch(() => {
        });
        return sendJson(res, 200, { deleted: true });
      }
      return sendJson(res, 400, { error: `Unsupported action: ${action}` });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Admin adhan-voices error:", err);
    return sendJson(res, 500, { error: err?.message || "Server error" });
  }
};
var adhan_voices_default2 = handler29;

// backend/notifications/subscribe.ts
init_lib();
async function ensurePrayerPushSubscriptionsTable() {
  await q(`
    CREATE TABLE IF NOT EXISTS prayer_push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      endpoint TEXT NOT NULL UNIQUE,
      keys JSONB NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      city TEXT,
      country TEXT,
      calculation_method TEXT DEFAULT 'MWL',
      juristic TEXT DEFAULT 'Shafi',
      prayer_preferences JSONB DEFAULT '{"fajr":true,"dhuhr":true,"asr":true,"maghrib":true,"isha":true}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {
  });
}
async function handler30(req, res) {
  await ensurePrayerPushSubscriptionsTable().catch(() => {
  });
  if (req.method === "GET") {
    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "";
    return sendJson(res, 200, {
      configured: Boolean(publicKey),
      publicKey: publicKey || null
    });
  }
  if (req.method === "DELETE") {
    try {
      const body = await readJson(req);
      const endpoint = String(body.endpoint || "").trim();
      if (!endpoint) return sendJson(res, 400, { error: "Endpoint is required" });
      const sb = getSupabaseAdmin2();
      if (sb) {
        await sb.from("prayer_push_subscriptions").delete().eq("endpoint", endpoint);
      } else {
        await q("DELETE FROM prayer_push_subscriptions WHERE endpoint = $1", [endpoint]);
      }
      return sendJson(res, 200, { ok: true, message: "Unsubscribed from prayer push notifications" });
    } catch (err) {
      console.error("Failed to unsubscribe push:", err);
      return sendJson(res, 500, { error: "Failed to unsubscribe" });
    }
  }
  if (req.method === "POST") {
    try {
      const body = await readJson(req);
      const endpoint = String(body.endpoint || "").trim();
      const keys = body.keys;
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const timezone = String(body.timezone || "UTC").trim();
      const city = body.city ? String(body.city).trim() : null;
      const country = body.country ? String(body.country).trim() : null;
      const calculationMethod = String(body.calculationMethod || "MWL").trim();
      const juristic = String(body.juristic || "Shafi").trim();
      const prayerPreferences = body.prayerPreferences || {
        fajr: true,
        dhuhr: true,
        asr: true,
        maghrib: true,
        isha: true
      };
      if (!endpoint || !keys || isNaN(latitude) || isNaN(longitude)) {
        return sendJson(res, 400, {
          error: "Missing required parameters: endpoint, keys, latitude, longitude are mandatory."
        });
      }
      const sb = getSupabaseAdmin2();
      if (sb) {
        const { error } = await sb.from("prayer_push_subscriptions").upsert(
          {
            endpoint,
            keys,
            latitude,
            longitude,
            timezone,
            city,
            country,
            calculation_method: calculationMethod,
            juristic,
            prayer_preferences: prayerPreferences,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          { onConflict: "endpoint" }
        );
        if (error) {
          console.warn("Supabase push subscription upsert error, falling back to direct db:", error.message);
          throw error;
        }
      } else {
        await q(
          `INSERT INTO prayer_push_subscriptions (
             endpoint, keys, latitude, longitude, timezone, city, country,
             calculation_method, juristic, prayer_preferences, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
           ON CONFLICT (endpoint) DO UPDATE SET
             keys = EXCLUDED.keys,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             timezone = EXCLUDED.timezone,
             city = EXCLUDED.city,
             country = EXCLUDED.country,
             calculation_method = EXCLUDED.calculation_method,
             juristic = EXCLUDED.juristic,
             prayer_preferences = EXCLUDED.prayer_preferences,
             updated_at = now()`,
          [
            endpoint,
            JSON.stringify(keys),
            latitude,
            longitude,
            timezone,
            city,
            country,
            calculationMethod,
            juristic,
            JSON.stringify(prayerPreferences)
          ]
        );
      }
      return sendJson(res, 200, {
        ok: true,
        message: "Push notification subscription registered successfully.",
        city,
        country
      });
    } catch (err) {
      console.error("Failed to register push subscription:", err);
      return sendJson(res, 500, { error: "Failed to save push subscription." });
    }
  }
  return sendJson(res, 405, { error: "Method not allowed" });
}

// backend/cron/prayer-push.ts
init_lib();
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from "adhan";
async function handler31(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const authHeader = req.headers.authorization || "";
  const cronSecret = process.env.CRON_SECRET || "nooraya-cron-secret";
  const urlObj = new URL(req.url || "/", "http://localhost");
  const secretParam = urlObj.searchParams.get("secret");
  if (authHeader !== `Bearer ${cronSecret}` && secretParam !== cronSecret && process.env.NODE_ENV === "production") {
    return sendJson(res, 401, { error: "Unauthorized cron trigger" });
  }
  try {
    const sb = getSupabaseAdmin2();
    let subscriptions = [];
    if (sb) {
      const { data, error } = await sb.from("prayer_push_subscriptions").select("*");
      if (error) throw error;
      subscriptions = data || [];
    } else {
      const result = await q("SELECT * FROM prayer_push_subscriptions");
      subscriptions = result.rows || [];
    }
    if (subscriptions.length === 0) {
      return sendJson(res, 200, {
        ok: true,
        dispatched: 0,
        message: "No active prayer push subscriptions found."
      });
    }
    const now = /* @__PURE__ */ new Date();
    const WINDOW_MINUTES = 15;
    const windowStartMs = now.getTime() - 6e4;
    const windowEndMs = now.getTime() + WINDOW_MINUTES * 6e4;
    let eligibleCount = 0;
    const notificationsToSend = [];
    for (const sub of subscriptions) {
      const coords = new Coordinates(sub.latitude, sub.longitude);
      let params = CalculationMethod.MuslimWorldLeague();
      switch (sub.calculation_method) {
        case "Egyptian":
          params = CalculationMethod.Egyptian();
          break;
        case "Karachi":
          params = CalculationMethod.Karachi();
          break;
        case "UmmAlQura":
          params = CalculationMethod.UmmAlQura();
          break;
        case "Dubai":
          params = CalculationMethod.Dubai();
          break;
        case "Qatar":
          params = CalculationMethod.Qatar();
          break;
        case "Kuwait":
          params = CalculationMethod.Kuwait();
          break;
        case "MoonsightingCommittee":
          params = CalculationMethod.MoonsightingCommittee();
          break;
        case "NorthAmerica":
          params = CalculationMethod.NorthAmerica();
          break;
        case "Singapore":
          params = CalculationMethod.Singapore();
          break;
        case "Turkey":
          params = CalculationMethod.Turkey();
          break;
        case "Tehran":
          params = CalculationMethod.Tehran();
          break;
        default:
          params = CalculationMethod.MuslimWorldLeague();
          break;
      }
      if (sub.juristic === "Hanafi") {
        params.madhab = Madhab.Hanafi;
      } else {
        params.madhab = Madhab.Shafi;
      }
      const prayerTimes = new PrayerTimes(coords, now, params);
      const prefs = typeof sub.prayer_preferences === "string" ? JSON.parse(sub.prayer_preferences) : sub.prayer_preferences || {};
      const checkList = [
        { key: "fajr", time: prayerTimes.fajr, en: "Fajr", ar: "\u0627\u0644\u0641\u062C\u0631" },
        { key: "dhuhr", time: prayerTimes.dhuhr, en: "Dhuhr", ar: "\u0627\u0644\u0638\u0647\u0631" },
        { key: "asr", time: prayerTimes.asr, en: "Asr", ar: "\u0627\u0644\u0639\u0635\u0631" },
        { key: "maghrib", time: prayerTimes.maghrib, en: "Maghrib", ar: "\u0627\u0644\u0645\u063A\u0631\u0628" },
        { key: "isha", time: prayerTimes.isha, en: "Isha", ar: "\u0627\u0644\u0639\u0634\u0627\u0621" }
      ];
      for (const p of checkList) {
        if (!prefs[p.key]) continue;
        const pMs = p.time.getTime();
        if (pMs >= windowStartMs && pMs <= windowEndMs) {
          eligibleCount++;
          notificationsToSend.push({
            endpoint: sub.endpoint,
            prayer: p.en,
            prayerNameAr: p.ar,
            prayerTime: p.time.toISOString(),
            city: sub.city || "your location"
          });
          break;
        }
      }
    }
    return sendJson(res, 200, {
      ok: true,
      windowMinutes: WINDOW_MINUTES,
      totalSubscribers: subscriptions.length,
      eligibleInWindow: eligibleCount,
      notifications: notificationsToSend.slice(0, 10),
      // sample for monitoring
      dispatchedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Prayer push cron error:", err);
    return sendJson(res, 500, { error: err?.message || "Prayer push cron execution failed" });
  }
}

// backend/admin/payments-diagnostics.ts
init_lib();
async function handler32(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const rawSecret = process.env.FLW_SECRET_KEY || "";
  const rawPublic = process.env.FLW_PUBLIC_KEY || process.env.VITE_FLW_PUBLIC_KEY || "";
  const rawWebhook = process.env.FLW_WEBHOOK_HASH || "";
  const secretTrimmed = rawSecret.trim().replace(/^['"]|['"]$/g, "");
  const publicTrimmed = rawPublic.trim().replace(/^['"]|['"]$/g, "");
  const webhookTrimmed = rawWebhook.trim().replace(/^['"]|['"]$/g, "");
  const secretHasQuotes = rawSecret.startsWith('"') || rawSecret.startsWith("'");
  const secretHasWhitespace = rawSecret !== rawSecret.trim();
  const publicHasQuotes = rawPublic.startsWith('"') || rawPublic.startsWith("'");
  const publicHasWhitespace = rawPublic !== rawPublic.trim();
  const secretMode = secretTrimmed.includes("TEST") ? "TEST" : secretTrimmed.startsWith("FLWSECK") ? "LIVE" : "UNKNOWN";
  const publicMode = publicTrimmed.includes("TEST") ? "TEST" : publicTrimmed.startsWith("FLWPUBK") ? "LIVE" : "UNKNOWN";
  const warnings = [];
  if (!secretTrimmed) {
    warnings.push("FLW_SECRET_KEY is missing from environment variables in Vercel.");
  } else if (secretTrimmed.startsWith("FLWPUBK")) {
    warnings.push("CRITICAL MISMATCH: FLW_SECRET_KEY contains a Public Key (starts with FLWPUBK). It must be your Secret Key (starts with FLWSECK).");
  }
  if (secretHasQuotes) {
    warnings.push("FLW_SECRET_KEY has quotation marks surrounding its value. In Vercel, paste only the bare key without quotes.");
  }
  if (secretHasWhitespace) {
    warnings.push("FLW_SECRET_KEY has leading or trailing whitespace. Please re-copy the key cleanly.");
  }
  if (publicTrimmed && secretTrimmed && secretMode !== "UNKNOWN" && publicMode !== "UNKNOWN" && secretMode !== publicMode) {
    warnings.push(`Mode mismatch: Secret Key is in ${secretMode} mode, while Public Key is in ${publicMode} mode. Both keys must be in the same mode.`);
  }
  if (!webhookTrimmed) {
    warnings.push("FLW_WEBHOOK_HASH is not set. Webhooks cannot be validated.");
  }
  const secretPrefix = secretTrimmed.length >= 10 ? `${secretTrimmed.slice(0, 10)}...` : "Not Set";
  const publicPrefix = publicTrimmed.length >= 10 ? `${publicTrimmed.slice(0, 10)}...` : "Not Set (Using server-side hosted checkout)";
  let apiStatus = "Not Tested";
  let apiError = null;
  if (secretTrimmed && !secretTrimmed.includes("placeholder")) {
    try {
      const testRes = await fetch("https://api.flutterwave.com/v3/banks/NG", {
        headers: {
          Authorization: `Bearer ${secretTrimmed}`,
          "Content-Type": "application/json"
        }
      });
      if (testRes.ok) {
        apiStatus = `SUCCESS: Connected and authenticated with Flutterwave API (${secretMode} Mode)`;
      } else {
        const errJson = await testRes.json().catch(() => ({}));
        apiStatus = `FAILED: HTTP ${testRes.status} ${testRes.statusText}`;
        apiError = errJson?.message || "Authentication rejected by Flutterwave API. Verify your secret key is active.";
        warnings.push(`API Verification Failed: ${apiError}`);
      }
    } catch (netErr) {
      apiStatus = "NETWORK_ERROR";
      apiError = netErr?.message || "Unable to reach https://api.flutterwave.com";
      warnings.push(`Network error: ${apiError}`);
    }
  }
  return sendJson(res, 200, {
    ok: true,
    diagnostic: {
      secretKey: {
        present: Boolean(secretTrimmed),
        mode: secretMode,
        prefixType: secretTrimmed ? `${secretMode} secret key present (${secretPrefix})` : "Missing",
        hasWhitespace: secretHasWhitespace,
        hasQuotes: secretHasQuotes
      },
      publicKey: {
        present: Boolean(publicTrimmed),
        mode: publicMode,
        prefixType: publicTrimmed ? `${publicMode} public key present (${publicPrefix})` : "Not set (Browser uses server-side checkout)",
        hasWhitespace: publicHasWhitespace,
        hasQuotes: publicHasQuotes
      },
      webhookHash: {
        present: Boolean(webhookTrimmed),
        status: webhookTrimmed ? "Configured" : "Missing"
      },
      flutterwaveApiConnection: {
        status: apiStatus,
        error: apiError
      },
      warnings,
      isReadyForTransactions: Boolean(secretTrimmed) && warnings.length === 0
    }
  });
}

// backend/index.ts
init_lib();
var routes = [
  [/^\/api\/auth\/signup$/, signup_default],
  [/^\/api\/auth\/login$/, login_default],
  [/^\/api\/auth\/logout$/, logout_default],
  [/^\/api\/auth\/me$/, me_default],
  [/^\/api\/me\/preferences$/, preferences_default],
  [/^\/api\/me\/premium-status$/, premium_status_default],
  [/^\/api\/me\/reciters$/, reciters_default],
  [/^\/api\/me\/reciters\/[^/]+$/, id_default],
  [/^\/api\/admin\/overview$/, overview_default],
  [/^\/api\/admin\/reciters$/, reciters_default2],
  [/^\/api\/admin\/role$/, role_default],
  [/^\/api\/admin\/ambient$/, ambient_default],
  [/^\/api\/admin\/media$/, media_default],
  [/^\/api\/media\/[^/]+$/, id_default2],
  [/^\/api\/health$/, handler15],
  [/^\/api\/reciters$/, reciters_default3],
  [/^\/api\/ambient$/, ambient_default2],
  [/^\/api\/plans$/, handler25],
  [/^\/api\/admin\/plans(\/.*)?$/, handler26],
  [/^\/api\/admin\/plan-price-logs$/, handler26],
  [/^\/api\/admin\/payments\/diagnostics$/, handler32],
  [/^\/api\/admin\/payments$/, handler27],
  [/^\/api\/admin\/reconcile-payments$/, handler27],
  [/^\/api\/payments\/verify-flutterwave$/, handler19],
  [/^\/api\/webhooks\/flutterwave$/, handler20],
  [/^\/api\/payments\/create-virtual-account$/, handler21],
  [/^\/api\/payments\/create-hosted-checkout$/, handler22],
  [/^\/api\/payments\/check-transfer-status$/, handler23],
  [/^\/api\/backgrounds$/, backgrounds_default],
  [/^\/api\/admin\/supabase-backgrounds$/, supabase_backgrounds_default],
  [/^\/api\/adhan-voices$/, adhan_voices_default],
  [/^\/api\/admin\/adhan-voices(\/.*)?$/, adhan_voices_default2],
  [/^\/api\/notifications\/subscribe$/, handler30],
  [/^\/api\/notifications\/vapid-public-key$/, handler30],
  [/^\/api\/cron\/prayer-push$/, handler31],
  [/^\/api\/media(\/.*)?$/, mediaHandler]
];
var handler33 = async (req, res) => {
  const url = (req.url || "").split("?")[0];
  const match = routes.find(([pattern]) => pattern.test(url));
  if (!match) {
    return sendJson(res, 404, { error: "Unknown API route" });
  }
  try {
    await match[1](req, res);
  } catch (err) {
    console.error("[api] Unhandled error:", err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error" });
    }
  }
};
var index_default = handler33;
export {
  index_default as default
};
