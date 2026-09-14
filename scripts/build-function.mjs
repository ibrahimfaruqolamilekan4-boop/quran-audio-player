// Builds the Serverless Function(s) that serve every /api route.
//
// backend/index.ts (TypeScript, imports every endpoint handler + pg) is
// bundled by esbuild into ONE self-contained plain-ESM file, emitted at three
// path-depth variants under api/:
//
//   api/[s1].js            -> /api/<one segment>   (health, reciters)
//   api/[s1]/[s2].js       -> /api/two segments    (auth/login, admin/*, ...)
//   api/[s1]/[s2]/[s3].js  -> /api/three segments  (me/reciters/<id>)
//
// Why not a `[...slug].js` catch-all: Vercel's function routing matched it as
// a SINGLE segment only — /api/health reached the handler while
// /api/auth/login 404'd at the edge. Single-segment [param] files in nested
// folders are the syntax proven to work (api/me/reciters/[id].ts served
// production traffic for months). Three identical 204KB functions is still
// well under the 12-function Hobby limit, and the router inside dispatches by
// req.url, so the depth variants are just route aliases.
//
// Everything (including pg) is inlined: dynamic `import('pg')` specifiers are
// exactly what dependency tracing misses in raw ESM entries. The createRequire
// banner exists because bundled CJS code (pg) falls back to require() at
// runtime, and pure-ESM output has no require — without it every DB call
// dies with `Dynamic require of "events" is not supported`.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { build } from 'esbuild';

const TARGETS = ['api/[s1].js', 'api/[s1]/[s2].js', 'api/[s1]/[s2]/[s3].js'];

const BANNER = [
  '// GENERATED FILE - DO NOT EDIT BY HAND.',
  '// Built from backend/ by scripts/build-function.mjs (run `npm run build`).',
  '// Committed because Vercel discovers /api functions from the source tree;',
  '// the build regenerates every copy, so they can never go stale on deploy.',
  "import { createRequire } from 'node:module';",
  'const require = createRequire(import.meta.url);',
].join('\n');

for (const outfile of TARGETS) {
  mkdirSync(dirname(outfile), { recursive: true });
  await build({
    entryPoints: ['backend/index.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    external: [],
    banner: { js: BANNER },
    logLevel: 'warning',
  });
  console.log(`built ${outfile}`);
}
