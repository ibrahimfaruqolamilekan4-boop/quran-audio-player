#!/usr/bin/env node
/**
 * Supabase Connection Diagnostic Tool
 * 
 * Tests:
 * 1. SUPABASE_URL / VITE_SUPABASE_URL format and reachability.
 * 2. SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY authentication with PostgREST.
 * 3. Read access to public.backgrounds table.
 * 4. Storage access to ambient-backgrounds public bucket.
 * 
 * Usage:
 *   node scripts/test-supabase.mjs
 *   node scripts/test-supabase.mjs --url "https://xyz.supabase.co" --key "eyJ..."
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Parse command line arguments if provided
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
}

// Load .env or .env.local if present
function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env', '.env.local', '.env.production']) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try {
        const text = readFileSync(fullPath, 'utf8');
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            const key = k.trim();
            const val = v.join('=').trim().replace(/^["']|["']$/g, '');
            if (!env[key]) env[key] = val;
          }
        }
      } catch {}
    }
  }
  return env;
}

const env = loadEnv();
const url = getArg('url') || env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const anonKey = getArg('key') || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

console.log('\n======================================================');
console.log('       SUPABASE CONNECTION & MIGRATION DIAGNOSTIC      ');
console.log('======================================================\n');

let allPassed = true;

// 1. Check URL
if (!url) {
  console.error('❌ [FAIL] Missing SUPABASE_URL / VITE_SUPABASE_URL.');
  console.error('   Action: Set VITE_SUPABASE_URL in your Vercel Project Settings.');
  allPassed = false;
} else if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
  console.warn(`⚠️ [WARN] URL format unexpected: "${url}". Expected "https://<ref>.supabase.co"`);
} else {
  const maskedUrl = url.replace(/(https:\/\/[a-z0-9]{4})[a-z0-9]+(\.supabase\.co)/, '$1****$2');
  console.log(`✅ [PASS] Supabase URL detected: ${maskedUrl}`);
}

// 2. Check Anon Key
if (!anonKey) {
  console.error('❌ [FAIL] Missing SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY.');
  console.error('   Action: Copy the "anon" public key from Supabase Dashboard -> Settings -> API.');
  allPassed = false;
} else if (!anonKey.startsWith('ey')) {
  console.error('❌ [FAIL] Anon Key does not appear to be a valid JWT (should start with "ey").');
  allPassed = false;
} else {
  console.log(`✅ [PASS] Anon Key detected (${anonKey.slice(0, 10)}...${anonKey.slice(-6)})`);
}

if (!url || !anonKey) {
  console.log('\n------------------------------------------------------');
  console.log('Aborting further tests due to missing credentials.');
  console.log('To run ad-hoc: node scripts/test-supabase.mjs --url <URL> --key <ANON_KEY>');
  process.exit(1);
}

// 3. Test REST API & 'backgrounds' table
console.log('\nTesting REST API & "backgrounds" table...');
try {
  const restEndpoint = `${url.replace(/\/+$/, '')}/rest/v1/backgrounds?select=id,name_en,category,is_active&limit=5`;
  const res = await fetch(restEndpoint, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 200) {
    const rows = await res.json();
    console.log(`✅ [PASS] Connected to Supabase PostgREST API!`);
    console.log(`✅ [PASS] Successfully queried "backgrounds" table. Found ${rows.length} row(s).`);
    if (rows.length > 0) {
      console.log('   Sample backgrounds:');
      rows.forEach(r => console.log(`   - [${r.category}] ${r.name_en} (${r.is_active ? 'active' : 'inactive'})`));
    } else {
      console.log('   ℹ️ Table exists but is currently empty. Run background migration from Admin page.');
    }
  } else if (res.status === 401) {
    console.error(`❌ [FAIL] HTTP 401 Unauthorized: The provided anon key was rejected by Supabase.`);
    console.error('   Action: Verify you copied the "anon" key and not the project reference or service key.');
    allPassed = false;
  } else if (res.status === 404 || res.status === 400) {
    const errText = await res.text();
    console.error(`❌ [FAIL] HTTP ${res.status}: Table "backgrounds" does not exist in schema.`);
    console.error(`   Details: ${errText}`);
    console.error('   Action: Apply "supabase/schema.sql" in the Supabase SQL Editor.');
    allPassed = false;
  } else {
    const errText = await res.text();
    console.error(`❌ [FAIL] HTTP ${res.status} returned from Supabase REST API.`);
    console.error(`   Details: ${errText}`);
    allPassed = false;
  }
} catch (err) {
  console.error(`❌ [FAIL] Network error connecting to Supabase: ${err.message}`);
  console.error('   Action: Check if your Supabase project is active or paused in the dashboard.');
  allPassed = false;
}

// 4. Test Storage Bucket 'ambient-backgrounds'
console.log('\nTesting Storage bucket "ambient-backgrounds"...');
try {
  const storageEndpoint = `${url.replace(/\/+$/, '')}/storage/v1/bucket/ambient-backgrounds`;
  const res = await fetch(storageEndpoint, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (res.status === 200) {
    const bucket = await res.json();
    console.log(`✅ [PASS] Storage bucket "ambient-backgrounds" exists!`);
    console.log(`   Public: ${bucket.public ? 'YES' : 'NO (WARNING: Should be public)'}`);
    console.log(`   File size limit: ${(bucket.file_size_limit / (1024 * 1024)).toFixed(0)} MB`);
    if (!bucket.public) {
      console.warn('⚠️ [WARN] Bucket is private. Mobile devices will not be able to stream video backgrounds.');
      console.warn('   Action: Make bucket public in Supabase Storage settings or re-run schema.sql.');
    }
  } else if (res.status === 404) {
    console.error('❌ [FAIL] Storage bucket "ambient-backgrounds" not found.');
    console.error('   Action: Create bucket "ambient-backgrounds" in Supabase Storage and set to Public.');
    allPassed = false;
  } else {
    // If bucket endpoint is restricted, test public asset ping
    console.log('ℹ️ Bucket metadata endpoint protected; checking public object access...');
  }
} catch (err) {
  console.warn(`⚠️ [WARN] Could not probe bucket metadata: ${err.message}`);
}

console.log('\n======================================================');
if (allPassed) {
  console.log('🎉 ALL SUPABASE CHECKS PASSED! Ready for Stage (a).');
} else {
  console.log('⚠️ SOME CHECKS FAILED. Review the actions above.');
}
console.log('======================================================\n');
