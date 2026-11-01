// Entry point for the /api Serverless Functions.
//
// Vercel Hobby allows at most 12 Serverless Functions per deployment. This app
// used to ship 13 (one file per endpoint under api/) and every production
// deployment failed with `exceeded_serverless_functions_per_deployment`, which
// blocked promotion to the production alias. All endpoint handlers now live in
// backend/ and are dispatched from this router, so the count can never
// silently exceed the plan limit again.
//
// scripts/build-function.mjs bundles this file (and everything it imports,
// including pg) into self-contained plain-ESM functions emitted at three path
// depths under api/ â€” [s1].js, [s1]/[s2].js and [s1]/[s2]/[s3].js. A
// `[...slug].js` catch-all does NOT work on Vercel: it matched a single
// segment only, so /api/auth/login 404'd at the edge. The router here
// dispatches on the full req.url, so the depth variants are pure route
// aliases. They are committed on purpose: Vercel discovers /api functions
// from the source tree, and `npm run build` regenerates all copies before
// every deploy so they can never go stale.
import type { IncomingMessage, ServerResponse } from 'node:http';

import signup from './auth/signup';
import login from './auth/login';
import logout from './auth/logout';
import me from './auth/me';
import preferences from './me/preferences';
import premiumStatus from './me/premium-status';
import reciters from './me/reciters';
import reciterById from './me/reciters/[id]';
import adminOverview from './admin/overview';
import adminReciters from './admin/reciters';
import adminRole from './admin/role';
import adminAmbient from './admin/ambient';
import adminMedia from './admin/media';
import publicMedia from './media/[id]';
import health from './health.mjs';
import publicReciters from './reciters';
import publicAmbient from './ambient';
import media from './media';
import verifyFlutterwave from './payments/verify';
import flwWebhook from './payments/webhook';
import createVirtualAccount from './payments/create-virtual-account';
import createHostedCheckout from './payments/create-hosted-checkout';
import checkTransferStatus from './payments/check-transfer-status';
import publicBackgrounds from './backgrounds';
import adminSupabaseBackgrounds from './admin/supabase-backgrounds';
import publicPlans from './plans';
import adminPlans from './admin/plans';
import adminPayments from './admin/payments';
import publicAdhanVoices from './adhan-voices';
import adminAdhanVoices from './admin/adhan-voices';
import notificationsSubscribe from './notifications/subscribe';
import cronPrayerPush from './cron/prayer-push';
import paymentsDiagnostics from './admin/payments-diagnostics';
import { sendJson } from './_lib.mjs';

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

// The same table vite.config.ts uses to serve /api in `vite dev` â€” keep in sync.
const routes: Array<[RegExp, Handler]> = [
  [/^\/api\/auth\/signup$/, signup],
  [/^\/api\/auth\/login$/, login],
  [/^\/api\/auth\/logout$/, logout],
  [/^\/api\/auth\/me$/, me],
  [/^\/api\/me\/preferences$/, preferences],
  [/^\/api\/me\/premium-status$/, premiumStatus],
  [/^\/api\/me\/reciters$/, reciters],
  [/^\/api\/me\/reciters\/[^/]+$/, reciterById],
  [/^\/api\/admin\/overview$/, adminOverview],
  [/^\/api\/admin\/reciters$/, adminReciters],
  [/^\/api\/admin\/role$/, adminRole],
  [/^\/api\/admin\/ambient$/, adminAmbient],
  [/^\/api\/admin\/media$/, adminMedia],
  [/^\/api\/media\/[^/]+$/, publicMedia],
  [/^\/api\/health$/, health],
  [/^\/api\/reciters$/, publicReciters],
  [/^\/api\/ambient$/, publicAmbient],
  [/^\/api\/plans$/, publicPlans],
  [/^\/api\/admin\/plans(\/.*)?$/, adminPlans],
  [/^\/api\/admin\/plan-price-logs$/, adminPlans],
  [/^\/api\/admin\/payments\/diagnostics$/, paymentsDiagnostics],
  [/^\/api\/admin\/payments$/, adminPayments],
  [/^\/api\/admin\/reconcile-payments$/, adminPayments],
  [/^\/api\/payments\/verify-flutterwave$/, verifyFlutterwave],
  [/^\/api\/webhooks\/flutterwave$/, flwWebhook],
  [/^\/api\/payments\/create-virtual-account$/, createVirtualAccount],
  [/^\/api\/payments\/create-hosted-checkout$/, createHostedCheckout],
  [/^\/api\/payments\/check-transfer-status$/, checkTransferStatus],
  [/^\/api\/backgrounds$/, publicBackgrounds],
  [/^\/api\/admin\/supabase-backgrounds$/, adminSupabaseBackgrounds],
  [/^\/api\/adhan-voices$/, publicAdhanVoices],
  [/^\/api\/admin\/adhan-voices(\/.*)?$/, adminAdhanVoices],
  [/^\/api\/notifications\/subscribe$/, notificationsSubscribe],
  [/^\/api\/notifications\/vapid-public-key$/, notificationsSubscribe],
  [/^\/api\/cron\/prayer-push$/, cronPrayerPush],
  [/^\/api\/media(\/.*)?$/, media],
];

const handler: Handler = async (req, res) => {
  const url = (req.url || '').split('?')[0];
  const match = routes.find(([pattern]) => pattern.test(url));
  if (!match) {
    return sendJson(res, 404, { error: 'Unknown API route' });
  }
  try {
    await match[1](req, res);
  } catch (err) {
    // Never leak internals; log for the runtime observability view.
    console.error('[api] Unhandled error:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' });
    }
  }
};

export default handler;
