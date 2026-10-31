import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import dotenv from 'dotenv';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A unique, human-readable stamp baked into every production build's index.html so we can
// curl the live site and know EXACTLY which commit/deploy is serving traffic.
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

/** Serves the /api serverless functions inside `vite dev` by delegating to backend/index.ts */
function apiDevPlugin(): Plugin {
  return {
    name: 'neon-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (!url.startsWith('/api/')) return next();
        try {
          const { default: handler } = await import('./backend/index');
          await handler(req, res);
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
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      buildIdPlugin(),
      apiDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon-64.png', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png', 'manifest.json'],
        manifest: {
          id: '/',
          name: 'Nooraya - Quran Audio Player',
          short_name: 'Nooraya',
          description: 'Immersive Quran audio player, ambient soundscapes, Qibla compass, and prayer times.',
          theme_color: '#06150F',
          background_color: '#06150F',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          categories: ['lifestyle', 'music', 'education', 'books'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
            },
          ],
        },
        workbox: {
          importScripts: ['/sw-push.js'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,jpg,jpeg,webp}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          navigateFallbackDenylist: [/^\/api\/.*/, /\.(?:mp3|mp4|m4a|webm|ogg|wav)$/i],
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/api\.quran\.com\/api\/v4\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'quran-api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
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
