/**
 * Rate-limited Production Diagnostics Upload Endpoint (`/api/diag`)
 *
 * Accepts opt-in client diagnostic bundles from `/diag` ("Send to Support")
 * and stores them in Supabase/Postgres (`diagnostic_reports` if table exists)
 * with an in-memory ring buffer fallback so support/admins can inspect reports immediately.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJson, sendJson, getPool } from './_lib.mjs';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitBucket>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const recentReports: Array<{
  reportId: string;
  createdAt: string;
  buildVersion: string;
  note: string;
  userAgent: string;
  standalone: boolean;
  viewport: any;
  videoSnapshot: any;
  eventCount: number;
  events: any[];
}> = [];

function getClientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.socket?.remoteAddress || 'unknown';
}

export default async function diagHandler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      count: recentReports.length,
      reports: recentReports.slice(0, 20),
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = rateLimitMap.get(ip);

  if (bucket && now < bucket.resetAt) {
    if (bucket.count >= RATE_LIMIT_MAX) {
      sendJson(res, 429, {
        error: 'Rate limit exceeded. Maximum 5 diagnostic reports per 10 minutes.',
      });
      return;
    }
    bucket.count += 1;
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  let body: any = {};
  try {
    body = (await readJson(req)) || {};
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON payload' });
    return;
  }

  const reportId = `diag_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const events = Array.isArray(body.events) ? body.events.slice(0, 250) : [];
  const entry = {
    reportId,
    createdAt: new Date(now).toISOString(),
    buildVersion: String(body.buildVersion || 'unknown').slice(0, 64),
    note: String(body.note || '').slice(0, 500),
    userAgent: String(body.userAgent || req.headers['user-agent'] || '').slice(0, 300),
    standalone: Boolean(body.standalone),
    viewport: body.viewport || null,
    videoSnapshot: body.videoSnapshot || null,
    eventCount: events.length,
    events,
  };

  recentReports.unshift(entry);
  if (recentReports.length > 50) {
    recentReports.length = 50;
  }

  // Best-effort persistence to Postgres / Supabase if configured
  try {
    const pool = await getPool();
    if (pool) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS diagnostic_reports (
          report_id TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          build_version TEXT,
          note TEXT,
          user_agent TEXT,
          standalone BOOLEAN DEFAULT FALSE,
          payload JSONB NOT NULL
        );
      `);
      await pool.query(
        `INSERT INTO diagnostic_reports (report_id, build_version, note, user_agent, standalone, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reportId,
          entry.buildVersion,
          entry.note,
          entry.userAgent,
          entry.standalone,
          JSON.stringify({
            viewport: entry.viewport,
            videoSnapshot: entry.videoSnapshot,
            events: entry.events,
          }),
        ]
      );
    }
  } catch (dbErr) {
    // Non-fatal: in-memory buffer still holds the report
    console.warn('[diag] DB persistence note:', (dbErr as any)?.message || dbErr);
  }

  sendJson(res, 200, {
    ok: true,
    reportId,
    storedEvents: events.length,
  });
}
