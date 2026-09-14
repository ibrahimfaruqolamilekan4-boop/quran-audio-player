// Builds the single catch-all Serverless Function that Vercel deploys.
//
// backend/index.ts (TypeScript, imports every endpoint handler) is bundled by
// esbuild into a self-contained plain-ESM file at api/[...slug].mjs. Vercel's
// Node runtime executes that artifact directly, so nothing can fail at boot
// over TypeScript transpiling or extensionless ESM specifiers — the failure
// mode that broke serverless deployments of sibling projects.
//
// Only two externals remain: node builtins and `pg`, which is present in the
// deployment's node_modules (installed from package-lock) and stays external
// to keep the bundle small and the native-free pure-JS driver intact.
import { mkdirSync } from 'node:fs';

import { build } from 'esbuild';

mkdirSync('api', { recursive: true });

await build({
  entryPoints: ['backend/index.ts'],
  // The artifact is COMMITTED to api/ (see the file header) because Vercel's
  // zero-config function discovery scans the source tree — a directory that
  // only exists after `vite build` may never be seen at all. `npm run build`
  // regenerates this file, so the committed copy never goes stale in CI.
  outfile: 'api/[...slug].js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // pg is imported dynamically (await import('pg')) inside backend/_lib.mjs.
  // Bundle it: the file is small, and a dynamic specifier is exactly the kind
  // of dependency Vercel's trace-only bundling can miss in a raw ESM entry.
  external: [],
  banner: {
    js: '// GENERATED FILE - DO NOT EDIT BY HAND.\n' +
      '// Built from backend/ by scripts/build-function.mjs (run `npm run build`).\n' +
      '// Committed because Vercel discovers /api functions from the source tree;\n' +
      '// the build regenerates it, so it can never go stale on deploy.\n',
  },
  logLevel: 'warning',
});

console.log('built api/[...slug].js (single /api function)');
