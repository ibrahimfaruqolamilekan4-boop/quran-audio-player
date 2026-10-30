import type { IncomingMessage, ServerResponse } from 'node:http';
import { q, sendJson, readJson, getSupabaseAdmin } from '../_lib';

export async function ensurePrayerPushSubscriptionsTable(): Promise<void> {
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
  `).catch(() => {});
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensurePrayerPushSubscriptionsTable().catch(() => {});

  if (req.method === 'GET') {
    // Return VAPID Public Key for Web Push registration
    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
    return sendJson(res, 200, {
      configured: Boolean(publicKey),
      publicKey: publicKey || null,
    });
  }

  if (req.method === 'DELETE') {
    try {
      const body = await readJson(req);
      const endpoint = String(body.endpoint || '').trim();
      if (!endpoint) return sendJson(res, 400, { error: 'Endpoint is required' });

      const sb = getSupabaseAdmin();
      if (sb) {
        await sb.from('prayer_push_subscriptions').delete().eq('endpoint', endpoint);
      } else {
        await q('DELETE FROM prayer_push_subscriptions WHERE endpoint = $1', [endpoint]);
      }

      return sendJson(res, 200, { ok: true, message: 'Unsubscribed from prayer push notifications' });
    } catch (err: any) {
      console.error('Failed to unsubscribe push:', err);
      return sendJson(res, 500, { error: 'Failed to unsubscribe' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await readJson(req);
      const endpoint = String(body.endpoint || '').trim();
      const keys = body.keys;
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const timezone = String(body.timezone || 'UTC').trim();
      const city = body.city ? String(body.city).trim() : null;
      const country = body.country ? String(body.country).trim() : null;
      const calculationMethod = String(body.calculationMethod || 'MWL').trim();
      const juristic = String(body.juristic || 'Shafi').trim();
      const prayerPreferences = body.prayerPreferences || {
        fajr: true,
        dhuhr: true,
        asr: true,
        maghrib: true,
        isha: true,
      };

      if (!endpoint || !keys || isNaN(latitude) || isNaN(longitude)) {
        return sendJson(res, 400, {
          error: 'Missing required parameters: endpoint, keys, latitude, longitude are mandatory.',
        });
      }

      const sb = getSupabaseAdmin();
      if (sb) {
        const { error } = await sb.from('prayer_push_subscriptions').upsert(
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
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );

        if (error) {
          console.warn('Supabase push subscription upsert error, falling back to direct db:', error.message);
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
            JSON.stringify(prayerPreferences),
          ]
        );
      }

      return sendJson(res, 200, {
        ok: true,
        message: 'Push notification subscription registered successfully.',
        city,
        country,
      });
    } catch (err: any) {
      console.error('Failed to register push subscription:', err);
      return sendJson(res, 500, { error: 'Failed to save push subscription.' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}
