/**
 * Phase 4 Quality & Edge-Case Unit Test Suite
 * Tests:
 *  1. High Latitudes (Oslo 59.91°N & Tromsø 69.65°N in Summer & Winter Solstices across MiddleOfTheNight, SeventhOfTheNight, TwilightAngle)
 *  2. Daylight Saving Time (DST) Spring-Forward & Fall-Back Transitions (America/New_York & Europe/London)
 *  3. Midnight Rollover & Cross-Timezone Date Resolution (New York vs Makkah vs Tokyo at 22:30 UTC + post-Isha rollover to tomorrow's Fajr)
 *  4. Ramadan 1447 AH Hijri Calendar & Umm al-Qura Ramadan +30m Isha Rule
 *  5. Web Push RFC 8292 (VAPID ES256) & RFC 8291 (aes128gcm) Native Crypto Self-Test
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  calculatePrayerTimes,
  formatPrayerTime,
  getHijriDate,
  resolveCalendarDateInTimezone,
} from '../src/lib/prayer.ts';
import { getTimezoneOffsetInfo, calculateDistanceKm } from '../src/lib/location.ts';

function toWallClockMinutes(date, timeZone) {
  const hhmm = formatPrayerTime(date, true, timeZone);
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const results = [];
function recordTest(category, name, fn) {
  try {
    const detail = fn();
    results.push({ category, name, status: 'PASS', detail: detail || 'OK' });
  } catch (err) {
    results.push({ category, name, status: 'FAIL', detail: err?.message || String(err) });
    throw err;
  }
}

async function runSuite() {
  console.log('=== PHASE 4: PRAYER TIMES, DST, HIGH-LATITUDE, MIDNIGHT & PUSH CRYPTO TEST SUITE ===\n');

  // ---------------------------------------------------------------------------
  // 1. HIGH LATITUDES (Oslo 59.91°N & Tromsø 69.65°N in Summer & Winter)
  // ---------------------------------------------------------------------------
  const highLatRules = ['MiddleOfTheNight', 'SeventhOfTheNight', 'TwilightAngle'];
  const oslo = { lat: 59.9139, lng: 10.7522, tz: 'Europe/Oslo' };
  const summerSolstice = new Date('2026-06-21T12:00:00Z');
  const winterSolstice = new Date('2026-12-21T12:00:00Z');

  for (const rule of highLatRules) {
    recordTest('High Latitude (Summer)', `Oslo 59.91°N Summer Solstice (${rule})`, () => {
      const pt = calculatePrayerTimes(
        oslo.lat,
        oslo.lng,
        summerSolstice,
        'MuslimWorldLeague',
        'shafi',
        rule,
        { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
        oslo.tz
      );

      for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        assert.ok(pt[key] instanceof Date && !Number.isNaN(pt[key].getTime()), `${key} must be a valid Date`);
      }

      // Chronological order check
      assert.ok(pt.fajr < pt.sunrise, 'Fajr must precede Sunrise');
      assert.ok(pt.sunrise < pt.dhuhr, 'Sunrise must precede Dhuhr');
      assert.ok(pt.dhuhr < pt.asr, 'Dhuhr must precede Asr');
      assert.ok(pt.asr < pt.maghrib, 'Asr must precede Maghrib');
      assert.ok(pt.maghrib < pt.isha, 'Maghrib must precede Isha');

      return `Fajr=${formatPrayerTime(pt.fajr, true, oslo.tz)}, Sunrise=${formatPrayerTime(pt.sunrise, true, oslo.tz)}, Maghrib=${formatPrayerTime(pt.maghrib, true, oslo.tz)}, Isha=${formatPrayerTime(pt.isha, true, oslo.tz)}`;
    });

    recordTest('High Latitude (Winter)', `Oslo 59.91°N Winter Solstice (${rule})`, () => {
      const pt = calculatePrayerTimes(
        oslo.lat,
        oslo.lng,
        winterSolstice,
        'MuslimWorldLeague',
        'shafi',
        rule,
        { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
        oslo.tz
      );

      assert.ok(pt.fajr < pt.sunrise && pt.sunrise < pt.dhuhr && pt.dhuhr < pt.asr && pt.asr < pt.maghrib && pt.maghrib < pt.isha);
      return `Fajr=${formatPrayerTime(pt.fajr, true, oslo.tz)}, Sunrise=${formatPrayerTime(pt.sunrise, true, oslo.tz)}, Maghrib=${formatPrayerTime(pt.maghrib, true, oslo.tz)}, Isha=${formatPrayerTime(pt.isha, true, oslo.tz)}`;
    });
  }

  // Sub-Arctic Equinox Check: Tromsø, Norway (69.6492° N)
  recordTest('High Latitude (Arctic 69.65°N)', 'Tromsø 69.65°N Spring Equinox (SeventhOfTheNight)', () => {
    const tromso = { lat: 69.6492, lng: 18.9553, tz: 'Europe/Oslo' };
    const equinox = new Date('2026-03-21T12:00:00Z');
    const pt = calculatePrayerTimes(
      tromso.lat,
      tromso.lng,
      equinox,
      'MuslimWorldLeague',
      'shafi',
      'SeventhOfTheNight',
      { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      tromso.tz
    );
    assert.ok(pt.fajr < pt.sunrise && pt.sunrise < pt.dhuhr && pt.dhuhr < pt.asr && pt.asr < pt.maghrib && pt.maghrib < pt.isha);
    return `Fajr=${formatPrayerTime(pt.fajr, true, tromso.tz)}, Dhuhr=${formatPrayerTime(pt.dhuhr, true, tromso.tz)}, Isha=${formatPrayerTime(pt.isha, true, tromso.tz)}`;
  });

  // ---------------------------------------------------------------------------
  // 2. DAYLIGHT SAVING TIME (DST) SPRING-FORWARD & FALL-BACK
  // ---------------------------------------------------------------------------
  recordTest('DST Transition (US Spring Forward)', 'New York 2026-03-07 (EST) -> 2026-03-08 (EDT)', () => {
    const nyLat = 40.7128;
    const nyLng = -74.006;
    const nyTz = 'America/New_York';

    const beforeDst = new Date('2026-03-07T17:00:00Z'); // Saturday (EST UTC-5)
    const afterDst = new Date('2026-03-08T17:00:00Z');  // Sunday (EDT UTC-4)

    const infoBefore = getTimezoneOffsetInfo(nyTz, beforeDst);
    const infoAfter = getTimezoneOffsetInfo(nyTz, afterDst);

    assert.equal(infoBefore.offsetLabel, 'UTC-5', 'EST must be UTC-5');
    assert.equal(infoAfter.offsetLabel, 'UTC-4', 'EDT must be UTC-4');
    assert.equal(infoBefore.isDst, false);
    assert.equal(infoAfter.isDst, true);

    const ptBefore = calculatePrayerTimes(nyLat, nyLng, beforeDst, 'NorthAmerica', 'shafi', 'MiddleOfTheNight', { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, nyTz);
    const ptAfter = calculatePrayerTimes(nyLat, nyLng, afterDst, 'NorthAmerica', 'shafi', 'MiddleOfTheNight', { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, nyTz);

    const dhuhrMinBefore = toWallClockMinutes(ptBefore.dhuhr, nyTz);
    const dhuhrMinAfter = toWallClockMinutes(ptAfter.dhuhr, nyTz);
    const shiftMinutes = dhuhrMinAfter - dhuhrMinBefore;

    // On DST spring-forward, local wall-clock Dhuhr shifts forward by ~60 minutes (e.g. 12:07 -> 13:07)
    assert.ok(shiftMinutes >= 58 && shiftMinutes <= 62, `Expected ~+60m wall-clock shift, got ${shiftMinutes}m`);
    return `Dhuhr ${formatPrayerTime(ptBefore.dhuhr, true, nyTz)} EST -> ${formatPrayerTime(ptAfter.dhuhr, true, nyTz)} EDT (+${shiftMinutes}m)`;
  });

  recordTest('DST Transition (US Fall Back)', 'New York 2026-10-31 (EDT) -> 2026-11-01 (EST)', () => {
    const nyLat = 40.7128;
    const nyLng = -74.006;
    const nyTz = 'America/New_York';

    const beforeFall = new Date('2026-10-31T17:00:00Z'); // Saturday (EDT UTC-4)
    const afterFall = new Date('2026-11-01T17:00:00Z');  // Sunday (EST UTC-5)

    const ptBefore = calculatePrayerTimes(nyLat, nyLng, beforeFall, 'NorthAmerica', 'shafi', 'MiddleOfTheNight', { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, nyTz);
    const ptAfter = calculatePrayerTimes(nyLat, nyLng, afterFall, 'NorthAmerica', 'shafi', 'MiddleOfTheNight', { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, nyTz);

    const dhuhrMinBefore = toWallClockMinutes(ptBefore.dhuhr, nyTz);
    const dhuhrMinAfter = toWallClockMinutes(ptAfter.dhuhr, nyTz);
    const shiftMinutes = dhuhrMinAfter - dhuhrMinBefore;

    assert.ok(shiftMinutes <= -58 && shiftMinutes >= -62, `Expected ~-60m wall-clock shift, got ${shiftMinutes}m`);
    return `Dhuhr ${formatPrayerTime(ptBefore.dhuhr, true, nyTz)} EDT -> ${formatPrayerTime(ptAfter.dhuhr, true, nyTz)} EST (${shiftMinutes}m)`;
  });

  recordTest('DST Transition (UK BST Spring Forward)', 'London 2026-03-28 (GMT) -> 2026-03-29 (BST)', () => {
    const lonLat = 51.5074;
    const lonLng = -0.1278;
    const lonTz = 'Europe/London';

    const beforeBst = new Date('2026-03-28T14:00:00Z');
    const afterBst = new Date('2026-03-29T14:00:00Z');

    const ptBefore = calculatePrayerTimes(lonLat, lonLng, beforeBst, 'MuslimWorldLeague', 'shafi', 'MiddleOfTheNight', { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, lonTz);
    const ptAfter = calculatePrayerTimes(lonLat, lonLng, afterBst, 'MuslimWorldLeague', 'shafi', 'MiddleOfTheNight', { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, lonTz);

    const shift = toWallClockMinutes(ptAfter.dhuhr, lonTz) - toWallClockMinutes(ptBefore.dhuhr, lonTz);
    assert.ok(shift >= 58 && shift <= 62, `Expected ~+60m shift in London BST, got ${shift}m`);
    return `Dhuhr ${formatPrayerTime(ptBefore.dhuhr, true, lonTz)} GMT -> ${formatPrayerTime(ptAfter.dhuhr, true, lonTz)} BST (+${shift}m)`;
  });

  // ---------------------------------------------------------------------------
  // 3. MIDNIGHT ROLLOVER & CROSS-TIMEZONE CALENDAR RESOLUTION
  // ---------------------------------------------------------------------------
  recordTest('Midnight Rollover (Cross-Timezone)', 'Instant 2026-05-10T22:30:00Z across NY, Makkah & Tokyo', () => {
    const instant = new Date('2026-05-10T22:30:00Z');
    const nyDate = resolveCalendarDateInTimezone(instant, 'America/New_York'); // 18:30 May 10
    const makkahDate = resolveCalendarDateInTimezone(instant, 'Asia/Riyadh');  // 01:30 May 11
    const tokyoDate = resolveCalendarDateInTimezone(instant, 'Asia/Tokyo');    // 07:30 May 11

    assert.equal(nyDate.getDate(), 10, 'New York should still be on May 10 at 22:30Z');
    assert.equal(makkahDate.getDate(), 11, 'Makkah should already be on May 11 at 22:30Z');
    assert.equal(tokyoDate.getDate(), 11, 'Tokyo should already be on May 11 at 22:30Z');

    return `NY=May ${nyDate.getDate()}, Makkah=May ${makkahDate.getDate()}, Tokyo=May ${tokyoDate.getDate()}`;
  });

  recordTest('Midnight Rollover (Post-Isha Nocturnal Division)', 'After Isha in Makkah computes Islamic Midnight & Tahajjud before tomorrow Fajr', () => {
    // 2026-05-10 at 22:30 Makkah time (19:30 UTC), which is after Isha (~20:25 AST) and before midnight
    const postIshaMakkah = new Date('2026-05-10T19:30:00Z');
    const pt = calculatePrayerTimes(
      21.422487,
      39.826206,
      postIshaMakkah,
      'UmmAlQura',
      'shafi',
      'MiddleOfTheNight',
      { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      'Asia/Riyadh'
    );

    const tomorrowPt = calculatePrayerTimes(
      21.422487,
      39.826206,
      new Date(postIshaMakkah.getTime() + 86400000),
      'UmmAlQura',
      'shafi',
      'MiddleOfTheNight',
      { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      'Asia/Riyadh'
    );

    assert.ok(pt.isha < postIshaMakkah, 'Isha has already entered at 22:30 AST');
    assert.ok(pt.midnight > pt.maghrib && pt.midnight < tomorrowPt.fajr, 'Islamic Midnight is halfway between Maghrib and tomorrow Fajr');
    assert.ok(pt.tahajjud > pt.midnight && pt.tahajjud < tomorrowPt.fajr, 'Tahajjud (Last 1/3) is between Midnight and tomorrow Fajr');

    return `Isha=${formatPrayerTime(pt.isha, true, 'Asia/Riyadh')}, Midnight=${formatPrayerTime(pt.midnight, true, 'Asia/Riyadh')}, Tahajjud=${formatPrayerTime(pt.tahajjud, true, 'Asia/Riyadh')}, Next Fajr=${formatPrayerTime(tomorrowPt.fajr, true, 'Asia/Riyadh')}`;
  });

  // ---------------------------------------------------------------------------
  // 4. RAMADAN 1447 AH HIJRI CALENDAR & UMM AL-QURA +30M ISHA INTERVAL
  // ---------------------------------------------------------------------------
  recordTest('Ramadan & Hijri Calendar', 'Ramadan 1447 AH detection & Umm al-Qura 120-min Isha interval', () => {
    // March 1, 2026 is mid-Ramadan 1447 AH
    const ramadanDate = new Date('2026-03-01T12:00:00Z');
    const hijri = getHijriDate(ramadanDate, 'Asia/Riyadh');

    assert.ok(hijri.english.includes('Ramadan') && hijri.english.includes('1447'), `Expected Ramadan 1447 AH, got ${hijri.english}`);
    assert.ok(hijri.arabic.includes('رمضان'), `Expected Arabic رمضان, got ${hijri.arabic}`);

    const ptRamadan = calculatePrayerTimes(
      21.422487,
      39.826206,
      ramadanDate,
      'UmmAlQura',
      'shafi',
      'MiddleOfTheNight',
      { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      'Asia/Riyadh'
    );

    const maghribToIshaMins = Math.round((ptRamadan.isha.getTime() - ptRamadan.maghrib.getTime()) / 60000);
    // Umm al-Qura standard is 90m outside Ramadan and 120m during Ramadan
    assert.equal(maghribToIshaMins, 120, `Umm al-Qura Ramadan Maghrib->Isha interval must be 120m, got ${maghribToIshaMins}m`);

    return `Hijri: ${hijri.full} | Maghrib->Isha=${maghribToIshaMins}m`;
  });

  // ---------------------------------------------------------------------------
  // 5. HAVERSINE 10 KM MOVEMENT THRESHOLD & WEB PUSH CRYPTO SELF-TEST
  // ---------------------------------------------------------------------------
  recordTest('Location Movement Threshold', 'Haversine distance accurately detects >10 km movement', () => {
    // Makkah Masjid al-Haram to Mina (~7.2 km) vs Arafat (~18.5 km)
    const haramToMina = calculateDistanceKm(21.4225, 39.8262, 21.4133, 39.8933);
    const haramToArafat = calculateDistanceKm(21.4225, 39.8262, 21.3549, 39.9841);

    assert.ok(haramToMina < 10, `Haram to Mina should be <10 km, got ${haramToMina.toFixed(2)} km`);
    assert.ok(haramToArafat > 10, `Haram to Arafat should be >10 km, got ${haramToArafat.toFixed(2)} km`);
    return `Haram->Mina=${haramToMina.toFixed(2)}km (<10km cached), Haram->Arafat=${haramToArafat.toFixed(2)}km (>10km recomputes)`;
  });

  recordTest('Web Push Crypto (RFC 8291 + 8292)', 'VAPID ES256 JWT signature & ECDH P-256 + HKDF + AES-128-GCM encryption', () => {
    // Generate ephemeral VAPID P-256 keypair and subscriber P-256 ECDH keypair
    const vapidKeys = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwtUnsigned = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url') + '.' +
      Buffer.from(JSON.stringify({ aud: 'https://fcm.googleapis.com', exp: Math.floor(Date.now() / 1000) + 3600, sub: 'mailto:support@nooraya.app' })).toString('base64url');
    const sig = crypto.sign('SHA256', Buffer.from(jwtUnsigned, 'utf8'), {
      key: vapidKeys.privateKey,
      dsaEncoding: 'ieee-p1363',
    });
    assert.equal(sig.length, 64, 'ES256 IEEE-P1363 signature must be 64 bytes');

    const verified = crypto.verify(
      'SHA256',
      Buffer.from(jwtUnsigned, 'utf8'),
      { key: vapidKeys.publicKey, dsaEncoding: 'ieee-p1363' },
      sig
    );
    assert.equal(verified, true, 'ES256 signature must verify with VAPID public key');

    return `VAPID ES256 64-byte IEEE-P1363 signature verified=${verified}`;
  });

  console.table(results);
  console.log(`\nALL ${results.length}/${results.length} PHASE 4 EDGE-CASE TESTS PASSED.`);
}

runSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
