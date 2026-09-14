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
  outfile: 'api/[...slug].mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: ['pg'],
  logLevel: 'warning',
});

console.log('built api/[...slug].mjs (single /api function)');
