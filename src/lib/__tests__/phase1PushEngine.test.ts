import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LATE_DELIVERY_THRESHOLD_MS,
  PUSH_DEFAULT_TTL_SECONDS,
  MAX_CONSECUTIVE_PUSH_FAILURES,
  formatTimeInTimezone,
  evaluateLateDelivery,
  shouldRetryPushStatus,
} from '../../../backend/push';
import { FEATURE_FLAG_CATALOG, isFeatureEnabled } from '../featureFlags';

describe('Phase 1 — PWA Closed-App Web Push Engine', () => {
  it('exposes the closedAppWebPushEngine feature flag with rollback plan', () => {
    const flag = FEATURE_FLAG_CATALOG.find((f) => f.key === 'closedAppWebPushEngine');
    expect(flag).toBeDefined();
    expect(flag!.rollbackPlan.length).toBeGreaterThan(20);
    expect(isFeatureEnabled('closedAppWebPushEngine')).toBe(true);
  });

  it('evaluates late push delivery accurately against the 10-minute threshold', () => {
    expect(LATE_DELIVERY_THRESHOLD_MS).toBe(10 * 60 * 1000);
    expect(PUSH_DEFAULT_TTL_SECONDS).toBe(1800);
    expect(MAX_CONSECUTIVE_PUSH_FAILURES).toBe(5);

    const prayerTime = '2026-11-20T12:35:00.000Z';
    const scheduledMs = Date.parse(prayerTime);

    // Arrives 2 minutes after prayer -> ON TIME
    const onTime = evaluateLateDelivery(prayerTime, scheduledMs + 2 * 60_000);
    expect(onTime.isLate).toBe(false);
    expect(onTime.delayMinutes).toBe(2);

    // Arrives exactly at 10 minutes -> boundary is still ON TIME
    const boundary = evaluateLateDelivery(prayerTime, scheduledMs + 10 * 60_000);
    expect(boundary.isLate).toBe(false);

    // Arrives 18 minutes late (phone was offline) -> LATE
    const late = evaluateLateDelivery(prayerTime, scheduledMs + 18 * 60_000);
    expect(late.isLate).toBe(true);
    expect(late.delayMinutes).toBe(18);

    // Invalid/missing timestamp safely returns not late
    expect(evaluateLateDelivery(null).isLate).toBe(false);
    expect(evaluateLateDelivery('not-a-date').isLate).toBe(false);
  });

  it('retries only transient push gateway statuses (408, 429, 5xx, network 0) and never expired 404/410', () => {
    expect(shouldRetryPushStatus(429)).toBe(true);
    expect(shouldRetryPushStatus(408)).toBe(true);
    expect(shouldRetryPushStatus(500)).toBe(true);
    expect(shouldRetryPushStatus(503)).toBe(true);
    expect(shouldRetryPushStatus(0)).toBe(true);

    expect(shouldRetryPushStatus(201)).toBe(false);
    expect(shouldRetryPushStatus(400)).toBe(false);
    expect(shouldRetryPushStatus(404)).toBe(false);
    expect(shouldRetryPushStatus(410)).toBe(false);
  });

  it('formats prayer times in the subscriber timezone (12h and 24h)', () => {
    const sample = new Date('2026-11-20T11:35:00.000Z');
    const lagos24 = formatTimeInTimezone(sample, 'Africa/Lagos', true);
    expect(lagos24).toContain('12:35');
    const lagos12 = formatTimeInTimezone(sample, 'Africa/Lagos', false);
    expect(lagos12).toMatch(/12:35\s?PM/i);
  });

  it('ships push-sw.js late-delivery guard, SQL pg_cron migration, and Deno Edge Function with zero hardcoded secrets', () => {
    const sw = fs.readFileSync(path.resolve(process.cwd(), 'public/push-sw.js'), 'utf8');
    expect(sw).toContain('was at');
    expect(sw).toContain('late=1');
    expect(sw).toContain('NOORAYA_PUSH_RECEIVED');

    const sql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20261120_prayer_push_scheduler.sql'),
      'utf8'
    );
    expect(sql).toContain('push_delivery_logs');
    expect(sql).toContain('UNIQUE (subscription_id, fire_key)');
    expect(sql).toContain('cron.schedule');
    expect(sql).toContain('vault.decrypted_secrets');
    expect(sql).not.toMatch(/ghp_[A-Za-z0-9]+|sk_live_|FLWSECK-/);

    const edgeFn = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/prayer-push-dispatch/index.ts'),
      'utf8'
    );
    expect(edgeFn).toContain('NOORAYA_APP_URL');
    expect(edgeFn).toContain('CRON_SECRET');
    expect(edgeFn).toContain('/api/push/dispatch');
  });
});
