// Entry point for the single catch-all Serverless Function.
//
// Vercel Hobby allows at most 12 Serverless Functions per deployment. This app
// used to ship 13 (one file per endpoint under api/) and every production
// deployment failed with `exceeded_serverless_functions_per_deployment`, which
// blocked promotion to the production alias. All endpoint handlers now live in
// backend/ and are dispatched from this one function, so the count can never
// silently exceed the plan limit again.
//
// scripts/build-function.mjs bundles this file (and everything it imports)
// into api/[...slug].mjs as plain, self-contained ESM JavaScript. Vercel runs
// that artifact directly on the Node runtime — no TS transpiling, no fragile
// extension rewriting at boot.
import type { IncomingMessage, ServerResponse } from 'node:http';

import signup from './auth/signup';
import login from './auth/login';
import logout from './auth/logout';
import me from './auth/me';
import preferences from './me/preferences';
import reciters from './me/reciters';
import reciterById from './me/reciters/[id]';
import adminOverview from './admin/overview';
import adminReciters from './admin/reciters';
import adminRole from './admin/role';
import adminAmbient from './admin/ambient';
import health from './health.mjs';
import publicReciters from './reciters';
import { sendJson } from './_lib.mjs';

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

// The same table vite.config.ts uses to serve /api in `vite dev` — keep in sync.
const routes: Array<[RegExp, Handler]> = [
  [/^\/api\/auth\/signup$/, signup],
  [/^\/api\/auth\/login$/, login],
  [/^\/api\/auth\/logout$/, logout],
  [/^\/api\/auth\/me$/, me],
  [/^\/api\/me\/preferences$/, preferences],
  [/^\/api\/me\/reciters$/, reciters],
  [/^\/api\/me\/reciters\/[^/]+$/, reciterById],
  [/^\/api\/admin\/overview$/, adminOverview],
  [/^\/api\/admin\/reciters$/, adminReciters],
  [/^\/api\/admin\/role$/, adminRole],
  [/^\/api\/admin\/ambient$/, adminAmbient],
  [/^\/api\/health$/, health],
  [/^\/api\/reciters$/, publicReciters],
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
