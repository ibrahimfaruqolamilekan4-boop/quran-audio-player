// Web Push Notification Engine & Per-Minute Scheduler (Phase 3)
// Implements RFC 8292 (VAPID ES256) + RFC 8291 (aes128gcm Web Push Encryption)
// using Node.js native `node:crypto` and `adhan` with zero external native dependencies.

import crypto from 'node:crypto';
import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Madhab,
  HighLatitudeRule,
} from 'adhan';
import { type Handler, q, readJson, sendJson, getAuthUser, serverStore, saveStore } from './_lib.mjs';
import { getSupabaseAdmin } from './lib/supabase-server';

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str: string): Buffer {
  const clean = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
  return Buffer.from(clean + pad, 'base64');
}

interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
  subject: string;
  configuredViaEnv: boolean;
}

let cachedVapidKeys: VapidKeyPair | null = null;

export async function ensurePushTables() {
  await q(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id                      TEXT PRIMARY KEY,
      user_id                 TEXT,
      endpoint                TEXT NOT NULL UNIQUE,
      p256dh                  TEXT NOT NULL,
      auth                    TEXT NOT NULL,
      user_agent              TEXT,
      platform                TEXT DEFAULT 'web',
      city_name               TEXT NOT NULL DEFAULT 'Makkah',
      country                 TEXT DEFAULT 'Saudi Arabia',
      latitude                DOUBLE PRECISION NOT NULL,
      longitude               DOUBLE PRECISION NOT NULL,
      timezone                TEXT NOT NULL DEFAULT 'Asia/Riyadh',
      calculation_method      TEXT NOT NULL DEFAULT 'UmmAlQura',
      madhab                  TEXT NOT NULL DEFAULT 'shafi',
      high_latitude_rule      TEXT NOT NULL DEFAULT 'MiddleOfTheNight',
      adjustments             JSONB NOT NULL DEFAULT '{"fajr":0,"sunrise":0,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}'::jsonb,
      prayer_reminders        JSONB NOT NULL DEFAULT '{"fajr":true,"sunrise":false,"dhuhr":true,"asr":true,"maghrib":true,"isha":true}'::jsonb,
      prayer_adhan_modes      JSONB NOT NULL DEFAULT '{"fajr":"full","sunrise":"silent","dhuhr":"full","asr":"full","maghrib":"full","isha":"full"}'::jsonb,
      reminder_minutes_before INT NOT NULL DEFAULT 0,
      active_adhan_voice_id   TEXT DEFAULT 'nabawi-khashuqji',
      use_fajr_adhan          BOOLEAN NOT NULL DEFAULT true,
      is_active               BOOLEAN NOT NULL DEFAULT true,
      last_sent_prayer_key    TEXT,
      last_sent_at            TIMESTAMPTZ,
      last_status             TEXT,
      failure_count           INT NOT NULL DEFAULT 0,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await q(`
    CREATE TABLE IF NOT EXISTS push_vapid_config (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});
}

/**
 * Resolves VAPID keys from environment variables (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`),
 * or generates and persists a P-256 keypair in `push_vapid_config` if env vars are not set.
 * Never logs or prints private keys.
 */
export async function getVapidKeys(): Promise<VapidKeyPair> {
  if (cachedVapidKeys) return cachedVapidKeys;

  const envPub = (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:admin@nooraya.app').trim();

  if (envPub && envPriv && !envPub.startsWith('Bxxxxx')) {
    cachedVapidKeys = {
      publicKey: envPub,
      privateKey: envPriv,
      subject,
      configuredViaEnv: true,
    };
    return cachedVapidKeys;
  }

  await ensurePushTables().catch(() => {});

  try {
    const existing = await q<{ public_key: string; private_key: string }>(
      `SELECT public_key, private_key FROM push_vapid_config WHERE id = 1`
    );
    if (existing.rows?.[0]?.public_key && existing.rows?.[0]?.private_key) {
      cachedVapidKeys = {
        publicKey: existing.rows[0].public_key,
        privateKey: existing.rows[0].private_key,
        subject,
        configuredViaEnv: false,
      };
      return cachedVapidKeys;
    }
  } catch {}

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const pubKey = base64UrlEncode(ecdh.getPublicKey());
  const privKey = base64UrlEncode(ecdh.getPrivateKey());

  try {
    await q(
      `INSERT INTO push_vapid_config (id, public_key, private_key, created_at)
       VALUES (1, $1, $2, now())
       ON CONFLICT (id) DO NOTHING`,
      [pubKey, privKey]
    );
  } catch {}

  cachedVapidKeys = {
    publicKey: pubKey,
    privateKey: privKey,
    subject,
    configuredViaEnv: false,
  };
  return cachedVapidKeys;
}

/**
 * Builds an RFC 8292 VAPID ES256 Authorization header (`vapid t=..., k=...`)
 * using Node.js native crypto JWK import.
 */
function createVapidAuthHeader(
  endpoint: string,
  vapid: VapidKeyPair
): { authorization: string; cryptoKey: string } {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp,
    sub: vapid.subject,
  };

  const unsignedToken = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(
    Buffer.from(JSON.stringify(payload))
  )}`;

  const pubBytes = base64UrlDecode(vapid.publicKey);
  // Uncompressed P-256 point: 0x04 || X (32 bytes) || Y (32 bytes)
  const x = base64UrlEncode(pubBytes.subarray(1, 33));
  const y = base64UrlEncode(pubBytes.subarray(33, 65));
  const d = vapid.privateKey;

  const privateKeyObj = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d,
    },
    format: 'jwk',
  });

  const signer = crypto.createSign('SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign({ key: privateKeyObj, dsaEncoding: 'ieee-p1363' });
  const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    cryptoKey: `p256ecdsa=${vapid.publicKey}`,
  };
}

/**
 * Encrypts a UTF-8 JSON payload according to RFC 8291 (`aes128gcm` Content-Encoding)
 * for Web Push delivery.
 */
function encryptWebPushPayload(
  payloadText: string,
  userPublicKeyB64: string,
  userAuthB64: string
): Buffer {
  const clientPublicKey = base64UrlDecode(userPublicKeyB64);
  const userAuth = base64UrlDecode(userAuthB64);

  const serverEcdh = crypto.createECDH('prime256v1');
  serverEcdh.generateKeys();
  const serverPublicKey = serverEcdh.getPublicKey();
  const sharedSecret = serverEcdh.computeSecret(clientPublicKey);

  const salt = crypto.randomBytes(16);

  // IKM via HKDF-SHA256: info = "WebPush: info\0" || ua_public || as_public
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'ascii'),
    clientPublicKey,
    serverPublicKey,
  ]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, userAuth, keyInfo, 32));

  // Content Encryption Key (CEK) & Nonce
  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'ascii');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'ascii');
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, cekInfo, 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, nonceInfo, 12));

  // Plaintext + 0x02 record delimiter
  const plaintext = Buffer.concat([Buffer.from(payloadText, 'utf8'), Buffer.from([2])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  // aes128gcm header: salt (16B) || rs (4B uint32BE = 4096) || idlen (1B = 65) || keyid (65B serverPublicKey)
  const rsBuf = Buffer.alloc(4);
  rsBuf.writeUInt32BE(4096, 0);
  const idLenBuf = Buffer.from([serverPublicKey.length]);

  return Buffer.concat([salt, rsBuf, idLenBuf, serverPublicKey, encrypted]);
}

/**
 * Sends a Web Push notification to a single subscription endpoint.
 */
export async function sendWebPushNotification(
  sub: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payloadObj: Record<string, any>
): Promise<{ ok: boolean; status: number; expired: boolean; error?: string }> {
  try {
    const vapid = await getVapidKeys();
    const { authorization } = createVapidAuthHeader(sub.endpoint, vapid);
    const bodyBuffer = encryptWebPushPayload(JSON.stringify(payloadObj), sub.p256dh, sub.auth);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '3600',
        Urgency: 'high',
      },
      body: new Uint8Array(bodyBuffer),
    });

    const expired = res.status === 404 || res.status === 410;
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      expired,
      error: res.ok ? undefined : `Push service returned HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      expired: false,
      error: err?.message || 'Push network failure',
    };
  }
}

function getCalculationParamsServer(
  method: string,
  madhab: string = 'shafi',
  highLatitudeRule: string = 'MiddleOfTheNight'
) {
  let params;
  switch (method) {
    case 'Egyptian':
      params = CalculationMethod.Egyptian();
      break;
    case 'Karachi':
      params = CalculationMethod.Karachi();
      break;
    case 'UmmAlQura':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'Dubai':
      params = CalculationMethod.Dubai();
      break;
    case 'Qatar':
      params = CalculationMethod.Qatar();
      break;
    case 'Kuwait':
      params = CalculationMethod.Kuwait();
      break;
    case 'Singapore':
      params = CalculationMethod.Singapore();
      break;
    case 'NorthAmerica':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'MoonsightingCommittee':
      params = CalculationMethod.MoonsightingCommittee();
      break;
    case 'Tehran':
      params = CalculationMethod.Tehran();
      break;
    case 'Turkey':
      params = CalculationMethod.Turkey
        ? CalculationMethod.Turkey()
        : CalculationMethod.MuslimWorldLeague();
      break;
    default:
      params = CalculationMethod.MuslimWorldLeague();
      break;
  }

  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  if (highLatitudeRule === 'SeventhOfTheNight') {
    params.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;
  } else if (highLatitudeRule === 'TwilightAngle') {
    params.highLatitudeRule = HighLatitudeRule.TwilightAngle;
  } else {
    params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;
  }
  return params;
}

function resolveCalendarDateInTz(date: Date, timezone: string): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    if (y && m && d) return new Date(y, m - 1, d, 12, 0, 0);
  } catch {}
  return date;
}

function computeSubscriberPrayerSchedule(sub: any, now: Date) {
  const coords = new Coordinates(Number(sub.latitude || 21.4225), Number(sub.longitude || 39.8262));
  const params = getCalculationParamsServer(
    sub.calculation_method || 'UmmAlQura',
    sub.madhab || 'shafi',
    sub.high_latitude_rule || 'MiddleOfTheNight'
  );
  const calDate = resolveCalendarDateInTz(now, sub.timezone || 'Asia/Riyadh');
  const pt = new PrayerTimes(coords, calDate, params);
  const adj = typeof sub.adjustments === 'object' && sub.adjustments ? sub.adjustments : {};
  const applyAdj = (d: Date, mins = 0) => new Date(d.getTime() + Number(mins || 0) * 60_000);

  return {
    fajr: applyAdj(pt.fajr, adj.fajr),
    sunrise: applyAdj(pt.sunrise, adj.sunrise),
    dhuhr: applyAdj(pt.dhuhr, adj.dhuhr),
    asr: applyAdj(pt.asr, adj.asr),
    maghrib: applyAdj(pt.maghrib, adj.maghrib),
    isha: applyAdj(pt.isha, adj.isha),
  };
}

const PRAYER_LABELS: Record<string, { english: string; arabic: string }> = {
  fajr: { english: 'Fajr', arabic: 'الفجر' },
  sunrise: { english: 'Sunrise', arabic: 'الشروق' },
  dhuhr: { english: 'Dhuhr', arabic: 'الظهر' },
  asr: { english: 'Asr', arabic: 'العصر' },
  maghrib: { english: 'Maghrib', arabic: 'المغرب' },
  isha: { english: 'Isha', arabic: 'العشاء' },
};

const handler: Handler = async (req, res) => {
  await ensurePushTables().catch(() => {});
  const urlObj = new URL(req.url || '/api/push', 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. GET /api/push/vapid-public-key
  if (req.method === 'GET' && pathname === '/api/push/vapid-public-key') {
    const vapid = await getVapidKeys();
    return sendJson(res, 200, {
      publicKey: vapid.publicKey,
      configuredViaEnv: vapid.configuredViaEnv,
    });
  }

  // 2. GET /api/push/diagnostics
  if (req.method === 'GET' && pathname === '/api/push/diagnostics') {
    const endpoint = urlObj.searchParams.get('endpoint') || '';
    const vapid = await getVapidKeys();
    const sb = getSupabaseAdmin();

    let subscriptionRow: any = null;
    let totalActiveCount = 0;

    if (sb) {
      try {
        const { count } = await sb
          .from('push_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        if (typeof count === 'number') totalActiveCount = count;

        if (endpoint) {
          const { data } = await sb
            .from('push_subscriptions')
            .select('*')
            .eq('endpoint', endpoint)
            .maybeSingle();
          if (data) subscriptionRow = data;
        }
      } catch {}
    }

    try {
      const countRes = await q<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM push_subscriptions WHERE is_active = true`
      );
      if (countRes.rows?.[0]?.count) {
        totalActiveCount = Math.max(totalActiveCount, Number(countRes.rows[0].count));
      }
      if (endpoint && !subscriptionRow) {
        const subRes = await q(`SELECT * FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
        if (subRes.rows?.[0]) subscriptionRow = subRes.rows[0];
      }
    } catch {}

    if (Array.isArray(serverStore.pushSubscriptions)) {
      const activeLocal = serverStore.pushSubscriptions.filter((r: any) => r.is_active !== false);
      totalActiveCount = Math.max(totalActiveCount, activeLocal.length);
      if (endpoint && !subscriptionRow) {
        subscriptionRow = serverStore.pushSubscriptions.find((r: any) => r.endpoint === endpoint) || null;
      }
    }

    let nextScheduledPrayer: { key: string; english: string; timeIso: string; minutesBefore: number } | null = null;
    const scheduleRow = subscriptionRow || (urlObj.searchParams.get('latitude') ? {
      latitude: Number(urlObj.searchParams.get('latitude')),
      longitude: Number(urlObj.searchParams.get('longitude')),
      timezone: urlObj.searchParams.get('timezone') || 'Asia/Riyadh',
      calculation_method: urlObj.searchParams.get('method') || 'UmmAlQura',
      madhab: 'shafi',
      high_latitude_rule: 'MiddleOfTheNight',
      reminder_minutes_before: 0,
      prayer_reminders: { fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true },
    } : null);

    if (scheduleRow) {
      const now = new Date();
      const schedule = computeSubscriberPrayerSchedule(scheduleRow, now);
      const reminders = scheduleRow.prayer_reminders || {};
      const minsBefore = Number(scheduleRow.reminder_minutes_before || 0);

      for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
        if (reminders[key] === false) continue;
        const pTime: Date = (schedule as any)[key];
        const triggerTime = new Date(pTime.getTime() - minsBefore * 60_000);
        if (triggerTime.getTime() > now.getTime()) {
          nextScheduledPrayer = {
            key,
            english: PRAYER_LABELS[key].english,
            timeIso: triggerTime.toISOString(),
            minutesBefore: minsBefore,
          };
          break;
        }
      }

      // If all of today's prayers have passed, roll over to tomorrow's first enabled prayer
      if (!nextScheduledPrayer) {
        const tomorrow = new Date(now.getTime() + 86_400_000);
        const tomorrowSchedule = computeSubscriberPrayerSchedule(scheduleRow, tomorrow);
        for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
          if (reminders[key] === false) continue;
          const pTime: Date = (tomorrowSchedule as any)[key];
          const triggerTime = new Date(pTime.getTime() - minsBefore * 60_000);
          nextScheduledPrayer = {
            key,
            english: PRAYER_LABELS[key].english,
            timeIso: triggerTime.toISOString(),
            minutesBefore: minsBefore,
          };
          break;
        }
      }
    }

    return sendJson(res, 200, {
      vapidPublicKeyReady: Boolean(vapid.publicKey),
      configuredViaEnv: vapid.configuredViaEnv,
      totalActiveSubscriptions: totalActiveCount,
      schedulerEngine: 'Supabase pg_cron (* * * * *) + /api/push/dispatch',
      subscription: subscriptionRow
        ? {
            id: subscriptionRow.id,
            cityName: subscriptionRow.city_name,
            timezone: subscriptionRow.timezone,
            method: subscriptionRow.calculation_method,
            reminderMinutesBefore: subscriptionRow.reminder_minutes_before,
            isActive: subscriptionRow.is_active,
            lastSentPrayerKey: subscriptionRow.last_sent_prayer_key,
            lastSentAt: subscriptionRow.last_sent_at,
            lastStatus: subscriptionRow.last_status,
            updatedAt: subscriptionRow.updated_at,
          }
        : null,
      nextScheduledPrayer,
    });
  }

  // 3. POST /api/push/subscribe
  if (req.method === 'POST' && pathname === '/api/push/subscribe') {
    const body = (await readJson(req)) as Record<string, any>;
    const sub = (body.subscription || {}) as Record<string, any>;
    const endpoint = String(sub.endpoint || body.endpoint || '').trim();
    const p256dh = String(sub.keys?.p256dh || body.p256dh || '').trim();
    const auth = String(sub.keys?.auth || body.auth || '').trim();

    if (!endpoint || !p256dh || !auth) {
      return sendJson(res, 400, { error: 'Valid PushSubscription (endpoint, p256dh, auth) is required.' });
    }

    const user = await getAuthUser(req).catch(() => null);
    const id = `push_${crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 24)}`;

    const record = {
      id,
      user_id: user?.uid || null,
      endpoint,
      p256dh,
      auth,
      user_agent: String(body.userAgent || req.headers['user-agent'] || '').slice(0, 250),
      platform: String(body.platform || 'web'),
      city_name: String(body.cityName || 'Makkah'),
      country: String(body.country || 'Saudi Arabia'),
      latitude: Number(body.latitude ?? 21.422487),
      longitude: Number(body.longitude ?? 39.826206),
      timezone: String(body.timezone || 'Asia/Riyadh'),
      calculation_method: String(body.method || 'UmmAlQura'),
      madhab: String(body.madhab || 'shafi'),
      high_latitude_rule: String(body.highLatitudeRule || 'MiddleOfTheNight'),
      adjustments: body.adjustments || { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      prayer_reminders: body.prayerReminders || {
        fajr: true,
        sunrise: false,
        dhuhr: true,
        asr: true,
        maghrib: true,
        isha: true,
      },
      prayer_adhan_modes: body.prayerAdhanModes || {
        fajr: 'full',
        sunrise: 'silent',
        dhuhr: 'full',
        asr: 'full',
        maghrib: 'full',
        isha: 'full',
      },
      reminder_minutes_before: Number(body.reminderMinutesBefore || 0),
      active_adhan_voice_id: String(body.activeAdhanVoiceId || 'nabawi-khashuqji'),
      use_fajr_adhan: body.useFajrAdhan !== false,
      is_active: true,
      failure_count: 0,
      updated_at: new Date().toISOString(),
    };

    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        await sb.from('push_subscriptions').upsert(record, { onConflict: 'endpoint' });
      } catch (e) {
        console.warn('Supabase push_subscriptions upsert notice:', e);
      }
    }

    try {
      await q(
        `INSERT INTO push_subscriptions (
           id, user_id, endpoint, p256dh, auth, user_agent, platform,
           city_name, country, latitude, longitude, timezone,
           calculation_method, madhab, high_latitude_rule,
           adjustments, prayer_reminders, prayer_adhan_modes,
           reminder_minutes_before, active_adhan_voice_id, use_fajr_adhan,
           is_active, failure_count, created_at, updated_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, $15,
           $16::jsonb, $17::jsonb, $18::jsonb,
           $19, $20, $21,
           true, 0, now(), now()
         )
         ON CONFLICT (endpoint) DO UPDATE SET
           user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id),
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           platform = EXCLUDED.platform,
           city_name = EXCLUDED.city_name,
           country = EXCLUDED.country,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           timezone = EXCLUDED.timezone,
           calculation_method = EXCLUDED.calculation_method,
           madhab = EXCLUDED.madhab,
           high_latitude_rule = EXCLUDED.high_latitude_rule,
           adjustments = EXCLUDED.adjustments,
           prayer_reminders = EXCLUDED.prayer_reminders,
           prayer_adhan_modes = EXCLUDED.prayer_adhan_modes,
           reminder_minutes_before = EXCLUDED.reminder_minutes_before,
           active_adhan_voice_id = EXCLUDED.active_adhan_voice_id,
           use_fajr_adhan = EXCLUDED.use_fajr_adhan,
           is_active = true,
           failure_count = 0,
           updated_at = now()`,
        [
          record.id,
          record.user_id,
          record.endpoint,
          record.p256dh,
          record.auth,
          record.user_agent,
          record.platform,
          record.city_name,
          record.country,
          record.latitude,
          record.longitude,
          record.timezone,
          record.calculation_method,
          record.madhab,
          record.high_latitude_rule,
          JSON.stringify(record.adjustments),
          JSON.stringify(record.prayer_reminders),
          JSON.stringify(record.prayer_adhan_modes),
          record.reminder_minutes_before,
          record.active_adhan_voice_id,
          record.use_fajr_adhan,
        ]
      );
    } catch (e) {
      console.warn('Database push_subscriptions upsert notice:', e);
    }

    if (!Array.isArray(serverStore.pushSubscriptions)) {
      serverStore.pushSubscriptions = [];
    }
    const existingIdx = serverStore.pushSubscriptions.findIndex((r: any) => r.endpoint === endpoint);
    if (existingIdx >= 0) {
      serverStore.pushSubscriptions[existingIdx] = { ...serverStore.pushSubscriptions[existingIdx], ...record };
    } else {
      serverStore.pushSubscriptions.push(record);
    }
    await saveStore().catch(() => {});

    return sendJson(res, 200, { ok: true, id: record.id });
  }

  // 4. POST /api/push/unsubscribe
  if (req.method === 'POST' && pathname === '/api/push/unsubscribe') {
    const body = await readJson(req);
    const endpoint = String(body.endpoint || '').trim();
    if (!endpoint) return sendJson(res, 400, { error: 'Endpoint is required' });

    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
      } catch {}
    }

    await q(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]).catch(() => {});

    if (Array.isArray(serverStore.pushSubscriptions)) {
      serverStore.pushSubscriptions = serverStore.pushSubscriptions.filter((r: any) => r.endpoint !== endpoint);
      await saveStore().catch(() => {});
    }

    return sendJson(res, 200, { ok: true });
  }

  // 5. POST /api/push/test -> Immediate test push notification
  if (req.method === 'POST' && pathname === '/api/push/test') {
    const body = (await readJson(req)) as Record<string, any>;
    const sub = (body.subscription || {}) as Record<string, any>;
    const endpoint = String(sub.endpoint || body.endpoint || '').trim();
    let p256dh = String(sub.keys?.p256dh || body.p256dh || '').trim();
    let auth = String(sub.keys?.auth || body.auth || '').trim();
    const cityName = String(body.cityName || 'your city');

    if (endpoint && (!p256dh || !auth)) {
      const dbRes = await q(`SELECT p256dh, auth FROM push_subscriptions WHERE endpoint = $1`, [endpoint]).catch(
        () => ({ rows: [] as any[] })
      );
      if (dbRes.rows?.[0]) {
        p256dh = dbRes.rows[0].p256dh;
        auth = dbRes.rows[0].auth;
      }
    }

    if (!endpoint || !p256dh || !auth) {
      return sendJson(res, 400, {
        error: 'No active push subscription keys found. Enable background notifications first.',
      });
    }

    const payload = {
      title: 'Nooraya Prayer Notification Test • حي على الصلاة',
      body: `Background push notifications are active for ${cityName}. Tap to open Nooraya and preview Adhan.`,
      prayerKey: 'fajr',
      url: '/dashboard/prayer-times?playAdhan=fajr',
      tag: `nooraya-test-${Date.now()}`,
      sentAt: new Date().toISOString(),
    };

    const pushRes = await sendWebPushNotification({ endpoint, p256dh, auth }, payload);
    const statusLabel = pushRes.ok ? `delivered_${pushRes.status}` : `error_${pushRes.status}`;

    await q(
      `UPDATE push_subscriptions
       SET last_sent_at = now(),
           last_status = $2,
           is_active = CASE WHEN $3 THEN false ELSE is_active END,
           updated_at = now()
       WHERE endpoint = $1`,
      [endpoint, statusLabel, pushRes.expired]
    ).catch(() => {});

    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        await sb
          .from('push_subscriptions')
          .update({
            last_sent_at: new Date().toISOString(),
            last_status: statusLabel,
            ...(pushRes.expired ? { is_active: false } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('endpoint', endpoint);
      } catch {}
    }

    if (!pushRes.ok) {
      return sendJson(res, 502, {
        ok: false,
        status: pushRes.status,
        expired: pushRes.expired,
        error: pushRes.error || 'Push delivery failed.',
      });
    }

    return sendJson(res, 200, {
      ok: true,
      status: pushRes.status,
      sentAt: payload.sentAt,
    });
  }

  // 6. POST or GET /api/push/dispatch -> Per-minute scheduler (invoked by Supabase pg_cron)
  if ((req.method === 'POST' || req.method === 'GET') && pathname === '/api/push/dispatch') {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    if (cronSecret && cronSecret !== 'change-me-cron-secret') {
      const authHeader = String(req.headers.authorization || '');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return sendJson(res, 401, { error: 'Unauthorized cron invocation' });
      }
    }

    const byEndpoint = new Map<string, any>();
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data } = await sb.from('push_subscriptions').select('*').eq('is_active', true);
        if (Array.isArray(data)) {
          for (const row of data) {
            if (row.endpoint) byEndpoint.set(row.endpoint, row);
          }
        }
      } catch {}
    }

    try {
      const dbRes = await q(`SELECT * FROM push_subscriptions WHERE is_active = true`);
      for (const row of dbRes.rows || []) {
        if (row.endpoint && !byEndpoint.has(row.endpoint)) {
          byEndpoint.set(row.endpoint, row);
        }
      }
    } catch {}

    if (Array.isArray(serverStore.pushSubscriptions)) {
      for (const row of serverStore.pushSubscriptions) {
        if (row.endpoint && row.is_active !== false && !byEndpoint.has(row.endpoint)) {
          byEndpoint.set(row.endpoint, row);
        }
      }
    }

    const now = new Date();
    const nowMs = now.getTime();
    let checked = 0;
    let sent = 0;
    let expiredDeactivated = 0;

    for (const sub of byEndpoint.values()) {
      checked++;
      const schedule = computeSubscriberPrayerSchedule(sub, now);
      const reminders = sub.prayer_reminders || {};
      const minsBefore = Number(sub.reminder_minutes_before || 0);
      const offsetMs = minsBefore * 60_000;

      let dateKey = now.toISOString().slice(0, 10);
      try {
        dateKey = new Intl.DateTimeFormat('en-CA', {
          timeZone: sub.timezone || 'Asia/Riyadh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(now);
      } catch {}

      for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
        if (reminders[key] === false) continue;
        const pTime: Date = (schedule as any)[key];
        if (!pTime || isNaN(pTime.getTime())) continue;

        const targetMs = pTime.getTime() - offsetMs;
        const diffMs = nowMs - targetMs;

        // Match within a [-30s, +90s] window around the minute tick
        if (diffMs >= -30_000 && diffMs <= 90_000) {
          const fireKey = `${dateKey}:${key}:${minsBefore}`;
          if (sub.last_sent_prayer_key === fireKey) continue;

          const label = PRAYER_LABELS[key];
          const title =
            minsBefore > 0
              ? `${label.english} (${label.arabic}) in ${minsBefore} min • ${sub.city_name}`
              : `It is time for ${label.english} (${label.arabic}) • ${sub.city_name}`;
          const bodyText =
            key === 'fajr'
              ? 'As-salatu khayrun min an-nawm (الصلاة خير من النوم) • Tap to listen to the Fajr Adhan.'
              : 'Hayya ’ala-s-Salah (حي على الصلاة) • Tap to open Nooraya and listen to the Adhan.';

          const pushRes = await sendWebPushNotification(sub, {
            title,
            body: bodyText,
            prayerKey: key,
            cityName: sub.city_name,
            url: `/dashboard/prayer-times?playAdhan=${key}`,
            tag: `adhan-${fireKey}`,
            sentAt: now.toISOString(),
          });

          if (pushRes.ok) {
            sent++;
          }
          if (pushRes.expired) {
            expiredDeactivated++;
          }

          const statusLabel = pushRes.ok ? `delivered_${pushRes.status}` : `error_${pushRes.status}`;
          await q(
            `UPDATE push_subscriptions
             SET last_sent_prayer_key = $2,
                 last_sent_at = now(),
                 last_status = $3,
                 is_active = CASE WHEN $4 THEN false ELSE is_active END,
                 updated_at = now()
             WHERE endpoint = $1`,
            [sub.endpoint, fireKey, statusLabel, pushRes.expired]
          ).catch(() => {});

          if (sb) {
            try {
              await sb
                .from('push_subscriptions')
                .update({
                  last_sent_prayer_key: fireKey,
                  last_sent_at: now.toISOString(),
                  last_status: statusLabel,
                  ...(pushRes.expired ? { is_active: false } : {}),
                  updated_at: now.toISOString(),
                })
                .eq('endpoint', sub.endpoint);
            } catch {}
          }
          break;
        }
      }
    }

    return sendJson(res, 200, {
      ok: true,
      checked,
      sent,
      expiredDeactivated,
      dispatchedAt: now.toISOString(),
    });
  }

  return sendJson(res, 404, { error: 'Unknown push route' });
};

export default handler;
