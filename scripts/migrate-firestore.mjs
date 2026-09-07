// One-time migration: Firestore -> Neon (Postgres).
//
// Reads via the Firestore REST API (no extra dependencies) and writes to Neon.
//
// Your deployed Firestore rules require a signed-in user for every collection,
// so a token is needed. Grab one from a browser that is logged in to the old app:
//
//   1. Open https://quran-audio-player-delta.vercel.app in a browser where you
//      are (or were) signed in with Google.
//   2. In the browser console run:
//        JSON.parse(localStorage.getItem(
//          Object.keys(localStorage).find(k => k.startsWith('firebase:authUser'))
//        )).stsTokenManager.refreshToken
//   3. Run the migration with that token:
//        FIRESTORE_REFRESH_TOKEN=<paste-token> node scripts/migrate-firestore.mjs
//
// (A short-lived ID token also works: FIRESTORE_ID_TOKEN=<token> node ...)
//
// Note: Firebase stores passwords in Firebase Auth, not Firestore, so migrated
// accounts arrive without a password. Each user sets one by using the "Sign up"
// tab with their same email — the API links it to the migrated profile.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '..', 'firebase-applet-config.json'), 'utf8'));

const BASE = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents`;

/** Exchange a long-lived Firebase refresh token for a fresh ID token. */
async function idTokenFromRefreshToken(refreshToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/token?key=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantType: 'refresh_token', refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id_token) {
    throw new Error(`Could not exchange refresh token (${res.status}): ${data.error?.message ?? 'unknown error'}`);
  }
  return data.id_token;
}

let ID_TOKEN = process.env.FIRESTORE_ID_TOKEN || null;

async function listCollection(path) {
  const query = new URLSearchParams();
  // Firestore REST identifies an unauthenticated web-app request via the ?key= param.
  if (!ID_TOKEN && config.apiKey) query.set('key', config.apiKey);
  const url = `${BASE}/${path}${query.toString() ? '?' + query.toString() : ''}`;
  const headers = {};
  if (ID_TOKEN) headers.Authorization = `Bearer ${ID_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Firestore read failed for "${path}" (${res.status}): ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  return (data.documents ?? []).map(decodeDoc);
}

function decodeDoc(doc) {
  const out = { _id: doc.name.split('/').pop() };
  for (const [key, value] of Object.entries(doc.fields ?? {})) {
    out[key] = decodeValue(value);
  }
  return out;
}

function decodeValue(v) {
  if (v === null || v === undefined) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) out[k] = decodeValue(val);
    return out;
  }
  return null;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function isoOrNull(v) {
  return typeof v === 'string' && v ? v : null;
}

async function main() {
  if (process.env.FIRESTORE_REFRESH_TOKEN && !ID_TOKEN) {
    console.log('Exchanging refresh token for an ID token...');
    ID_TOKEN = await idTokenFromRefreshToken(process.env.FIRESTORE_REFRESH_TOKEN);
  }

  console.log('Migrating Firestore -> Neon...\n');

  // 1. Global reciters
  try {
    const docs = await listCollection('global_reciters');
    for (const d of docs) {
      await pool.query(
        `INSERT INTO global_reciters (id, name, style, server_url, updated_at)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style = EXCLUDED.style, server_url = EXCLUDED.server_url`,
        [d._id, d.name ?? d._id, d.style ?? null, d.serverUrl ?? '', isoOrNull(d.updatedAt)]
      );
    }
    console.log(`global_reciters: ${docs.length} rows`);
  } catch (e) {
    console.warn(`global_reciters: skipped (${e.message})`);
  }

  // 2. Ambient sounds
  try {
    const docs = await listCollection('ambient_sounds');
    for (const d of docs) {
      await pool.query(
        `INSERT INTO ambient_sounds (id, name, video_url, updated_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, video_url = EXCLUDED.video_url`,
        [d._id, d.name ?? d._id, d.videoUrl ?? null, isoOrNull(d.updatedAt)]
      );
    }
    console.log(`ambient_sounds: ${docs.length} rows`);
  } catch (e) {
    console.warn(`ambient_sounds: skipped (${e.message})`);
  }

  // 3. Users + subcollections (needs a token)
  if (!ID_TOKEN) {
    console.log('\nusers / preferences / customReciters: SKIPPED (no token provided).');
    console.log('See the header of this script for how to obtain one, then re-run to include private data.');
  } else {
    try {
      const users = await listCollection('users');
      for (const u of users) {
        await pool.query(
          `INSERT INTO users (uid, email, display_name, photo_url, role, created_at, last_login_at)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7::timestamptz)
           ON CONFLICT (uid) DO UPDATE SET
             email = EXCLUDED.email,
             display_name = COALESCE(EXCLUDED.display_name, users.display_name),
             photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
             role = EXCLUDED.role`,
          [
            u._id,
            (u.email ?? `${u._id}@migrated.local`).toLowerCase(),
            u.displayName ?? null,
            u.photoURL ?? null,
            u.role === 'admin' ? 'admin' : 'user',
            isoOrNull(u.createdAt),
            isoOrNull(u.lastLoginAt),
          ]
        );
        console.log(`  user ${u.email ?? u._id} (${u.role ?? 'user'})`);

        const prefs = await listCollection(`users/${u._id}/preferences`).catch(() => []);
        const p = prefs.find(x => x._id === 'default') ?? prefs[0];
        if (p) {
          await pool.query(
            `INSERT INTO user_preferences (user_uid, theme, active_background_video_id, ambient_video_mapping, updated_at)
             VALUES ($1, COALESCE($2, 'midnight-scholar'), $3, COALESCE($4, '{}'::jsonb), now())
             ON CONFLICT (user_uid) DO UPDATE SET
               theme = EXCLUDED.theme,
               active_background_video_id = EXCLUDED.active_background_video_id,
               ambient_video_mapping = EXCLUDED.ambient_video_mapping`,
            [u._id, p.theme ?? null, p.activeBackgroundVideoId ?? null, JSON.stringify(p.ambientVideoMapping ?? {})]
          );
          console.log(`  preferences for ${u.email ?? u._id}`);
        }

        const reciters = await listCollection(`users/${u._id}/customReciters`).catch(() => []);
        for (const r of reciters) {
          await pool.query(
            `INSERT INTO custom_reciters (id, user_uid, name, style, server_url)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style = EXCLUDED.style, server_url = EXCLUDED.server_url`,
            [r._id, u._id, r.name ?? r._id, r.style ?? 'Custom', r.serverUrl ?? '']
          );
        }
        if (reciters.length) console.log(`  customReciters for ${u.email ?? u._id}: ${reciters.length} rows`);
      }
      console.log(`users: ${users.length} rows`);
    } catch (e) {
      console.warn(`users: skipped (${e.message})`);
    }
  }

  // 4. Summary
  const counts = {};
  for (const t of ['users', 'user_preferences', 'custom_reciters', 'global_reciters', 'ambient_sounds']) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    counts[t] = rows[0].n;
  }
  console.log('\nRow counts in Neon:', counts);
  console.log('\nMigration finished.');
}

main()
  .catch(err => { console.error('Migration failed:', err); process.exitCode = 1; })
  .finally(() => pool.end());
