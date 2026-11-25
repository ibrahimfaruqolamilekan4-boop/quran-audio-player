// GET /api/admin/payments/diagnostics
// Safe diagnostic tool for Flutterwave credentials and connectivity.
// NEVER prints, logs, or returns any full secret key, hash, or password.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireAdmin, sendJson } from '../_lib.mjs';
import {
  getFlutterwaveSecretKey,
  getFlutterwaveEnvInfo,
} from '../lib/flutterwave';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const info = getFlutterwaveEnvInfo();
  const secretKey = getFlutterwaveSecretKey();

  let apiStatus = 'Not Tested';
  let apiError: string | null = null;
  const warnings = [...info.warnings];

  if (secretKey) {
    try {
      const testRes = await fetch('https://api.flutterwave.com/v3/banks/NG', {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (testRes.ok) {
        apiStatus = `SUCCESS: Connected and authenticated with Flutterwave API (${info.secretMode} Mode)`;
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
        present: info.hasSecret,
        variableDetected: info.secretKeyName,
        mode: info.secretMode,
        prefixType: info.hasSecret ? `${info.secretMode} secret key present (${info.secretPrefix})` : 'Missing',
      },
      publicKey: {
        present: info.hasPublic,
        variableDetected: info.publicKeyName,
        mode: info.publicMode,
        prefixType: info.hasPublic ? `${info.publicMode} public key present (${info.publicPrefix})` : 'Not set (Browser uses server-side checkout)',
      },
      webhookHash: {
        present: info.hasWebhookHash,
        status: info.hasWebhookHash ? 'Configured' : 'Missing',
      },
      flutterwaveApiConnection: {
        status: apiStatus,
        error: apiError,
      },
      warnings,
      isReadyForTransactions: info.hasSecret && warnings.length === 0,
    },
  });
}
