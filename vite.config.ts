import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import dotenv from 'dotenv';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    base: './',
    plugins: [react(), tailwindcss(), apiDevPlugin()],
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
