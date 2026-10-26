// GET /api/admin/payments/diagnostics
// Safe diagnostic tool for Flutterwave credentials and connectivity.
// NEVER prints, logs, or returns any full secret key, hash, or password.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireAdmin, sendJson } from '../_lib.mjs';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const rawSecret = process.env.FLW_SECRET_KEY || '';
  const rawPublic = process.env.FLW_PUBLIC_KEY || process.env.VITE_FLW_PUBLIC_KEY || '';
  const rawWebhook = process.env.FLW_WEBHOOK_HASH || '';

  const secretTrimmed = rawSecret.trim().replace(/^['"]|['"]$/g, '');
  const publicTrimmed = rawPublic.trim().replace(/^['"]|['"]$/g, '');
  const webhookTrimmed = rawWebhook.trim().replace(/^['"]|['"]$/g, '');

  const secretHasQuotes = rawSecret.startsWith('"') || rawSecret.startsWith("'");
  const secretHasWhitespace = rawSecret !== rawSecret.trim();
  const publicHasQuotes = rawPublic.startsWith('"') || rawPublic.startsWith("'");
  const publicHasWhitespace = rawPublic !== rawPublic.trim();

  // Mode detection
  const secretMode = secretTrimmed.includes('TEST')
    ? 'TEST'
    : secretTrimmed.startsWith('FLWSECK')
    ? 'LIVE'
    : 'UNKNOWN';

  const publicMode = publicTrimmed.includes('TEST')
    ? 'TEST'
    : publicTrimmed.startsWith('FLWPUBK')
    ? 'LIVE'
    : 'UNKNOWN';

  const warnings: string[] = [];

  if (!secretTrimmed) {
    warnings.push('FLW_SECRET_KEY is missing from environment variables in Vercel.');
  } else if (secretTrimmed.startsWith('FLWPUBK')) {
    warnings.push('CRITICAL MISMATCH: FLW_SECRET_KEY contains a Public Key (starts with FLWPUBK). It must be your Secret Key (starts with FLWSECK).');
  }

  if (secretHasQuotes) {
    warnings.push('FLW_SECRET_KEY has quotation marks surrounding its value. In Vercel, paste only the bare key without quotes.');
  }
  if (secretHasWhitespace) {
    warnings.push('FLW_SECRET_KEY has leading or trailing whitespace. Please re-copy the key cleanly.');
  }

  if (publicTrimmed && secretTrimmed && secretMode !== 'UNKNOWN' && publicMode !== 'UNKNOWN' && secretMode !== publicMode) {
    warnings.push(`Mode mismatch: Secret Key is in ${secretMode} mode, while Public Key is in ${publicMode} mode. Both keys must be in the same mode.`);
  }

  if (!webhookTrimmed) {
    warnings.push('FLW_WEBHOOK_HASH is not set. Webhooks cannot be validated.');
  }

  // Safe Prefix masks (first 10 chars only)
  const secretPrefix = secretTrimmed.length >= 10 ? `${secretTrimmed.slice(0, 10)}...` : 'Not Set';
  const publicPrefix = publicTrimmed.length >= 10 ? `${publicTrimmed.slice(0, 10)}...` : 'Not Set (Using server-side hosted checkout)';

  // Connectivity Test with Flutterwave API (Banks Endpoint)
  let apiStatus = 'Not Tested';
  let apiError: string | null = null;

  if (secretTrimmed && !secretTrimmed.includes('placeholder')) {
    try {
      const testRes = await fetch('https://api.flutterwave.com/v3/banks/NG', {
        headers: {
          Authorization: `Bearer ${secretTrimmed}`,
          'Content-Type': 'application/json',
        },
      });

      if (testRes.ok) {
        apiStatus = `SUCCESS: Connected and authenticated with Flutterwave API (${secretMode} Mode)`;
      } else {
        const errJson = (await testRes.json().catch(() => ({}))) as any;
        apiStatus = `FAILED: HTTP ${testRes.status} ${testRes.statusText}`;
        apiError = errJson?.message || 'Authentication rejected by Flutterwave API. Verify your secret key is active.';
        warnings.push(`API Verification Failed: ${apiError}`);
      }
    } catch (netErr: any) {
      apiStatus = 'NETWORK_ERROR';
      apiError = netErr?.message || 'Unable to reach https://api.flutterwave.com';
      warnings.push(`Network error: ${apiError}`);
    }
  }

  return sendJson(res, 200, {
    ok: true,
    diagnostic: {
      secretKey: {
        present: Boolean(secretTrimmed),
        mode: secretMode,
        prefixType: secretTrimmed ? `${secretMode} secret key present (${secretPrefix})` : 'Missing',
        hasWhitespace: secretHasWhitespace,
        hasQuotes: secretHasQuotes,
      },
      publicKey: {
        present: Boolean(publicTrimmed),
        mode: publicMode,
        prefixType: publicTrimmed ? `${publicMode} public key present (${publicPrefix})` : 'Not set (Browser uses server-side checkout)',
        hasWhitespace: publicHasWhitespace,
        hasQuotes: publicHasQuotes,
      },
      webhookHash: {
        present: Boolean(webhookTrimmed),
        status: webhookTrimmed ? 'Configured' : 'Missing',
      },
      flutterwaveApiConnection: {
        status: apiStatus,
        error: apiError,
      },
      warnings,
      isReadyForTransactions: Boolean(secretTrimmed) && warnings.length === 0,
    },
  });
}
