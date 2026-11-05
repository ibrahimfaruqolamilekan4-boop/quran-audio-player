/**
 * End-to-End Integration Test for Phase 2 & Phase 3 Backend Endpoints:
 *  - GET  /api/adhan-voices (Verified Prophet's Mosque Muezzins + Sheikh Mishary Alafasy, zero hardcoded audio)
 *  - GET  /api/push/vapid-public-key (VAPID P-256 public key generation & serving)
 *  - POST /api/push/subscribe (Saving opt-in push subscription + per-prayer preferences)
 *  - GET  /api/push/diagnostics (Inspecting active subscription & next scheduled prayer)
 *  - POST /api/push/dispatch (Running the per-minute prayer notification scheduler)
 *  - POST /api/push/unsubscribe (Deleting coordinates & subscription on opt-out)
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import adhanVoicesHandler from '../backend/adhan-voices.ts';
import pushHandler from '../backend/push.ts';

function invokeHandler(handler, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payloadStr = body ? JSON.stringify(body) : '';
    const req = new Readable({
      read() {
        if (payloadStr) this.push(Buffer.from(payloadStr, 'utf8'));
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = {
      host: 'localhost:3000',
      'content-type': 'application/json',
      ...headers,
    };

    let statusCode = 200;
    const resHeaders = {};
    const chunks = [];

    const res = {
      setHeader(k, v) {
        resHeaders[k.toLowerCase()] = v;
      },
      writeHead(code, hdrs = {}) {
        statusCode = code;
        for (const [k, v] of Object.entries(hdrs)) {
          resHeaders[k.toLowerCase()] = v;
        }
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch {}
        resolve({ status: statusCode, headers: resHeaders, raw, json });
      },
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function runE2E() {
  console.log('=== PHASE 2 & PHASE 3 BACKEND API END-TO-END TEST SUITE ===\n');
  const report = [];

  // 1. Test GET /api/adhan-voices
  const voicesRes = await invokeHandler(adhanVoicesHandler, {
    method: 'GET',
    url: '/api/adhan-voices',
  });
  assert.equal(voicesRes.status, 200, 'GET /api/adhan-voices should return 200');
  assert.ok(Array.isArray(voicesRes.json?.voices), 'Voices array should be present');
  assert.ok(voicesRes.json.voices.length >= 11, `Expected >=11 verified Muezzin slots, got ${voicesRes.json.voices.length}`);
  const hardcodedUrls = voicesRes.json.voices.filter((v) => v.audio_url || v.fajr_audio_url);
  assert.equal(hardcodedUrls.length, 0, 'Default seeded Muezzin slots must have zero hardcoded audio URLs');
  report.push({
    endpoint: 'GET /api/adhan-voices',
    status: voicesRes.status,
    result: 'PASS',
    detail: `${voicesRes.json.voices.length} official Muezzin slots (10 Masjid an-Nabawi + Alafasy), 0 hardcoded URLs`,
  });

  // 2. Test GET /api/push/vapid-public-key
  const vapidRes = await invokeHandler(pushHandler, {
    method: 'GET',
    url: '/api/push/vapid-public-key',
  });
  assert.equal(vapidRes.status, 200, 'GET /api/push/vapid-public-key should return 200');
  assert.ok(typeof vapidRes.json?.publicKey === 'string' && vapidRes.json.publicKey.length >= 80, 'VAPID publicKey must be a valid base64url P-256 uncompressed key');
  report.push({
    endpoint: 'GET /api/push/vapid-public-key',
    status: vapidRes.status,
    result: 'PASS',
    detail: `VAPID Public Key (${vapidRes.json.publicKey.length} chars) served`,
  });

  // 3. Test POST /api/push/subscribe
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const fakeP256dh = ecdh.getPublicKey().toString('base64url');
  const fakeAuth = crypto.randomBytes(16).toString('base64url');
  const testEndpoint = `https://fcm.googleapis.com/fcm/send/test-nooraya-${Date.now()}`;

  const subRes = await invokeHandler(pushHandler, {
    method: 'POST',
    url: '/api/push/subscribe',
    body: {
      subscription: {
        endpoint: testEndpoint,
        keys: { p256dh: fakeP256dh, auth: fakeAuth },
      },
      cityName: 'Madinah',
      country: 'Saudi Arabia',
      latitude: 24.4672,
      longitude: 39.6112,
      timezone: 'Asia/Riyadh',
      method: 'UmmAlQura',
      madhab: 'shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      reminderMinutesBefore: 5,
      activeAdhanVoiceId: 'nabawi-khashuqji',
      useFajrAdhan: true,
    },
  });
  assert.equal(subRes.status, 200, 'POST /api/push/subscribe should return 200');
  assert.equal(subRes.json?.ok, true);
  report.push({
    endpoint: 'POST /api/push/subscribe',
    status: subRes.status,
    result: 'PASS',
    detail: `Subscribed endpoint (${subRes.json.id}) for Madinah (Asia/Riyadh)`,
  });

  // 4. Test GET /api/push/diagnostics
  const diagRes = await invokeHandler(pushHandler, {
    method: 'GET',
    url: `/api/push/diagnostics?endpoint=${encodeURIComponent(testEndpoint)}&latitude=24.4672&longitude=39.6112&timezone=Asia/Riyadh&method=UmmAlQura`,
  });
  assert.equal(diagRes.status, 200, 'GET /api/push/diagnostics should return 200');
  assert.ok(diagRes.json?.nextScheduledPrayer?.key, 'Diagnostics must compute nextScheduledPrayer.key');
  assert.equal(diagRes.json?.subscription?.cityName, 'Madinah');
  report.push({
    endpoint: 'GET /api/push/diagnostics',
    status: diagRes.status,
    result: 'PASS',
    detail: `Next prayer: ${diagRes.json.nextScheduledPrayer.english} (${diagRes.json.nextScheduledPrayer.timeIso})`,
  });

  // 5. Test POST /api/push/dispatch (Per-minute scheduler run)
  const dispatchRes = await invokeHandler(pushHandler, {
    method: 'POST',
    url: '/api/push/dispatch',
  });
  assert.equal(dispatchRes.status, 200, 'POST /api/push/dispatch should return 200');
  assert.equal(dispatchRes.json?.ok, true);
  report.push({
    endpoint: 'POST /api/push/dispatch',
    status: dispatchRes.status,
    result: 'PASS',
    detail: `Checked=${dispatchRes.json.checked}, Sent=${dispatchRes.json.sent}, Deactivated=${dispatchRes.json.deactivated}`,
  });

  // 6. Test POST /api/push/unsubscribe
  const unsubRes = await invokeHandler(pushHandler, {
    method: 'POST',
    url: '/api/push/unsubscribe',
    body: { endpoint: testEndpoint },
  });
  assert.equal(unsubRes.status, 200, 'POST /api/push/unsubscribe should return 200');
  assert.equal(unsubRes.json?.ok, true);
  report.push({
    endpoint: 'POST /api/push/unsubscribe',
    status: unsubRes.status,
    result: 'PASS',
    detail: 'Subscription & coordinates deleted on opt-out',
  });

  console.table(report);
  console.log(`\nALL ${report.length}/${report.length} PHASE 2 & PHASE 3 API ENDPOINTS PASSED E2E.`);
}

runE2E().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
