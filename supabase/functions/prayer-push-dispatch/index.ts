/**
 * Supabase Edge Function: prayer-push-dispatch
 *
 * Triggered every minute by Supabase pg_cron (or external cron monitor).
 * Forwards authenticated dispatch requests to Nooraya's `/api/push/dispatch`
 * using environment secrets (`NOORAYA_APP_URL`, `CRON_SECRET`) — zero hardcoded values.
 *
 * Deploy with:
 *   supabase secrets set NOORAYA_APP_URL=https://quran-audio-player-delta.vercel.app CRON_SECRET=<secret>
 *   supabase functions deploy prayer-push-dispatch --no-verify-jwt
 */

// @ts-ignore Deno runtime import
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

declare const Deno: {
  env: { get(key: string): string | undefined };
};

serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cronSecret = (Deno.env.get('CRON_SECRET') || '').trim();
  const appUrl = (Deno.env.get('NOORAYA_APP_URL') || '').trim().replace(/\/+$/, '');

  if (cronSecret) {
    const incomingAuth = req.headers.get('authorization') || '';
    if (incomingAuth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (!appUrl) {
    return new Response(
      JSON.stringify({ error: 'NOORAYA_APP_URL secret is not configured in Supabase Edge Functions.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const startedAt = Date.now();
  try {
    const upstream = await fetch(`${appUrl}/api/push/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({
        source: 'supabase_edge_function',
        triggeredAt: new Date().toISOString(),
      }),
    });

    const bodyText = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = { raw: bodyText.slice(0, 500) };
    }

    return new Response(
      JSON.stringify({
        ok: upstream.ok,
        upstreamStatus: upstream.status,
        durationMs: Date.now() - startedAt,
        result: parsed,
      }),
      {
        status: upstream.ok ? 200 : 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
