import type { IncomingMessage, ServerResponse } from 'node:http';
import { q, sendJson } from '../_lib.mjs';
import { getSupabaseAdmin } from '../lib/supabase-server';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // Authorize cron trigger via header or query secret
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET || 'nooraya-cron-secret';
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const secretParam = urlObj.searchParams.get('secret');

  if (authHeader !== `Bearer ${cronSecret}` && secretParam !== cronSecret && process.env.NODE_ENV === 'production') {
    // In production, enforce secret check
    return sendJson(res, 401, { error: 'Unauthorized cron trigger' });
  }

  try {
    const sb = getSupabaseAdmin();
    let subscriptions: any[] = [];

    if (sb) {
      const { data, error } = await sb.from('prayer_push_subscriptions').select('*');
      if (error) throw error;
      subscriptions = data || [];
    } else {
      const result = await q('SELECT * FROM prayer_push_subscriptions');
      subscriptions = result.rows || [];
    }

    if (subscriptions.length === 0) {
      return sendJson(res, 200, {
        ok: true,
        dispatched: 0,
        message: 'No active prayer push subscriptions found.',
      });
    }

    const now = new Date();
    const WINDOW_MINUTES = 15;
    const windowStartMs = now.getTime() - 60_000; // 1 min ago
    const windowEndMs = now.getTime() + WINDOW_MINUTES * 60_000; // 15 mins ahead

    let eligibleCount = 0;
    const notificationsToSend: Array<{
      endpoint: string;
      prayer: string;
      prayerNameAr: string;
      prayerTime: string;
      city: string;
    }> = [];

    for (const sub of subscriptions) {
      const coords = new Coordinates(sub.latitude, sub.longitude);
      let params = CalculationMethod.MuslimWorldLeague();

      switch (sub.calculation_method) {
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
        case 'MoonsightingCommittee':
          params = CalculationMethod.MoonsightingCommittee();
          break;
        case 'NorthAmerica':
          params = CalculationMethod.NorthAmerica();
          break;
        case 'Singapore':
          params = CalculationMethod.Singapore();
          break;
        case 'Turkey':
          params = CalculationMethod.Turkey();
          break;
        case 'Tehran':
          params = CalculationMethod.Tehran();
          break;
        default:
          params = CalculationMethod.MuslimWorldLeague();
          break;
      }

      if (sub.juristic === 'Hanafi') {
        params.madhab = Madhab.Hanafi;
      } else {
        params.madhab = Madhab.Shafi;
      }

      const prayerTimes = new PrayerTimes(coords, now, params);
      const prefs = typeof sub.prayer_preferences === 'string'
        ? JSON.parse(sub.prayer_preferences)
        : sub.prayer_preferences || {};

      const checkList = [
        { key: 'fajr', time: prayerTimes.fajr, en: 'Fajr', ar: 'الفجر' },
        { key: 'dhuhr', time: prayerTimes.dhuhr, en: 'Dhuhr', ar: 'الظهر' },
        { key: 'asr', time: prayerTimes.asr, en: 'Asr', ar: 'العصر' },
        { key: 'maghrib', time: prayerTimes.maghrib, en: 'Maghrib', ar: 'المغرب' },
        { key: 'isha', time: prayerTimes.isha, en: 'Isha', ar: 'العشاء' },
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
            city: sub.city || 'your location',
          });
          break; // Avoid double triggering
        }
      }
    }

    return sendJson(res, 200, {
      ok: true,
      windowMinutes: WINDOW_MINUTES,
      totalSubscribers: subscriptions.length,
      eligibleInWindow: eligibleCount,
      notifications: notificationsToSend.slice(0, 10), // sample for monitoring
      dispatchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Prayer push cron error:', err);
    return sendJson(res, 500, { error: err?.message || 'Prayer push cron execution failed' });
  }
}
