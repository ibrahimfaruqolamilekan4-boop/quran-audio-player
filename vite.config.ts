import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import dotenv from 'dotenv';
import { execSync } from 'node:child_process';
import signup from './api/auth/signup';
import login from './api/auth/login';
import logout from './api/auth/logout';
import me from './api/auth/me';
import preferences from './api/me/preferences';
import reciters from './api/me/reciters';
import reciterById from './api/me/reciters/[id]';
import adminOverview from './api/admin/overview';
import adminReciters from './api/admin/reciters';
import adminRole from './api/admin/role';
import adminAmbient from './api/admin/ambient';
import health from './api/health.mjs';
import publicReciters from './api/reciters';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A unique, human-readable stamp baked into every production build's index.html so we can
// curl the live site and know EXACTLY which commit/deploy is serving traffic. The recurring
// "did my fix actually deploy?" question is impossible to answer without this, because a
// failed promotion still returns HTTP 200 with a stale bundle.
function buildId(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
  let sha = env ? env.slice(0, 7) : '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      sha = 'unknown';
    }
  }
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + 'Z';
  return `${sha} @ ${stamp}`;
}

/** Injects the build id into index.html as a meta tag + HTML comment. */
function buildIdPlugin(): Plugin {
  const id = buildId();
  return {
    name: 'build-id',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <!-- build: ${id} -->\n    <meta name="build-id" content="${id}" />`,
      );
    },
  };
}

// The /api handlers read process.env directly (as they do on Vercel),
// so load .env into process.env for local development.
dotenv.config({ path: path.resolve(__dirname, '.env') });

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

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

/** Serves the /api serverless functions inside `vite dev` so one command runs the whole app. */
function apiDevPlugin(): Plugin {
  return {
    name: 'neon-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (!url.startsWith('/api/')) return next();
        const match = routes.find(([pattern]) => pattern.test(url));
        if (!match) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unknown API route' }));
          return;
        }
        try {
          await match[1](req, res);
        } catch (err) {
          console.error('[api-dev] Unhandled error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    // Must stay absolute: vercel.json rewrites every unknown path to /index.html, so with a
    // relative base the SPA would request /dashboard/assets/*.js on deep links and page
    // refreshes. That hits the rewrite, returns HTML instead of JavaScript and the whole
    // app silently fails to boot (blank dashboard, no surahs, nothing to play).
    base: '/',
    plugins: [react(), tailwindcss(), buildIdPlugin(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
