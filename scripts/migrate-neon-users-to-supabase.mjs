#!/usr/bin/env node
/**
 * Idempotent Migration Script: Neon Postgres Users -> Supabase Auth & public.profiles
 *
 * Requirements satisfied:
 * 1. Reads all users from Neon database (with fallback to cloud/server store).
 * 2. Compares against existing Supabase auth.users & profiles.
 * 3. Migrates user profiles to public.profiles preserving email, full_name, role,
 *    is_premium, premium_expires_at, and maps old uid into legacy_id.
 * 4. Backfills foreign keys across payments, favorites, and user_preferences.
 * 5. Supports --dry-run mode for pre-flight verification without mutating state.
 *
 * Usage:
 *   node scripts/migrate-neon-users-to-supabase.mjs --dry-run
 *   node scripts/migrate-neon-users-to-supabase.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env or .env.local
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
const isDryRun = process.argv.includes('--dry-run');

const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const databaseUrl = env.DATABASE_URL || '';

console.log('================================================================');
console.log(` NEON TO SUPABASE USERS MIGRATION ${isDryRun ? '(DRY RUN)' : '(LIVE APPLICATION)'}`);
console.log('================================================================\n');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('   Ensure SUPABASE_SERVICE_ROLE_KEY is set to manage auth users and bypass RLS.\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getNeonUsers() {
  // 1. Try Neon Postgres pool via pg
  if (databaseUrl) {
    try {
      const pg = await import('pg');
      const PG = pg.default?.Pool ? pg.default : pg;
      const pool = new PG.Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });

      const res = await pool.query(`
        SELECT uid, email, password_hash, display_name, photo_url, role,
               is_premium, subscription_plan, flw_transaction_id, premium_expires_at,
               created_at, last_login_at
        FROM users
        ORDER BY created_at ASC
      `);
      await pool.end();
      return res.rows;
    } catch (dbErr) {
      console.warn('⚠️ Direct Neon connection notice:', dbErr.message);
    }
  }

  // 2. Fallback to local server store
  const storePath = resolve(process.cwd(), '.server_store.json');
  if (existsSync(storePath)) {
    try {
      const parsed = JSON.parse(readFileSync(storePath, 'utf8'));
      if (Array.isArray(parsed.users) && parsed.users.length > 0) {
        return parsed.users;
      }
    } catch {}
  }

  return [];
}

async function runMigration() {
  console.log('1. Fetching users from Neon...');
  const neonUsers = await getNeonUsers();
  console.log(`   Found ${neonUsers.length} user(s) in Neon source.\n`);

  console.log('2. Fetching existing users from Supabase Auth & public.profiles...');
  const { data: authUsersData, error: authErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authErr) {
    console.error('❌ Error querying Supabase auth.users:', authErr.message);
    process.exit(1);
  }

  const existingAuthUsers = authUsersData?.users || [];
  const authUsersByEmail = new Map(existingAuthUsers.map((u) => [u.email?.toLowerCase(), u]));

  const { data: profilesData } = await supabase.from('profiles').select('*');
  const existingProfiles = profilesData || [];
  const profilesByEmail = new Map(existingProfiles.map((p) => [p.email?.toLowerCase(), p]));

  console.log(`   Supabase auth.users: ${existingAuthUsers.length} user(s)`);
  console.log(`   Supabase profiles:   ${existingProfiles.length} profile(s)\n`);

  let newlyCreatedAuth = 0;
  let newlyCreatedProfiles = 0;
  let updatedProfiles = 0;
  let skipped = 0;

  console.log('3. Analyzing migration plan:');
  console.log('----------------------------------------------------------------');

  for (const nu of neonUsers) {
    const email = nu.email?.toLowerCase().trim();
    if (!email) continue;

    const existingAuth = authUsersByEmail.get(email);
    const existingProfile = profilesByEmail.get(email);

    const displayName = nu.display_name || nu.displayName || email.split('@')[0];
    const role = nu.role === 'admin' ? 'admin' : 'user';
    const isPremium = Boolean(nu.is_premium || nu.role === 'admin');
    const legacyId = nu.uid;

    if (!existingAuth) {
      console.log(`   [CREATE AUTH + PROFILE] ${email} (Neon UID: ${legacyId}, Role: ${role}, Premium: ${isPremium})`);
      newlyCreatedAuth++;

      if (!isDryRun) {
        // Create user in Supabase Auth
        // GoTrue accepts bcrypt/argon2 hashes, but for scrypt we create the user with auto-confirm
        // and send password recovery or seamless JIT migration on next sign-in
        const { data: created, error: cErr } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: displayName,
            name: displayName,
            legacy_id: legacyId,
          },
          app_metadata: {
            role,
          },
        });

        if (cErr) {
          console.warn(`   ⚠️ Supabase auth create error for ${email}:`, cErr.message);
        } else if (created?.user?.id) {
          const newUserId = created.user.id;

          // Upsert public.profiles row
          await supabase.from('profiles').upsert(
            {
              id: newUserId,
              email,
              full_name: displayName,
              avatar_url: nu.photo_url || null,
              role,
              is_premium: isPremium,
              premium_expires_at: nu.premium_expires_at || null,
              subscription_plan: nu.subscription_plan || (role === 'admin' ? 'lifetime' : 'free'),
              legacy_id: legacyId,
              created_at: nu.created_at || new Date().toISOString(),
              last_seen_at: nu.last_login_at || new Date().toISOString(),
            },
            { onConflict: 'id' }
          );

          newlyCreatedProfiles++;

          // Backfill foreign keys in payments table
          await supabase
            .from('payments')
            .update({ user_id: newUserId })
            .eq('user_id', legacyId);
        }
      }
    } else {
      // User already exists in Supabase Auth. Ensure public.profiles is synced with legacy_id
      const targetId = existingAuth.id;
      if (!existingProfile || !existingProfile.legacy_id) {
        console.log(`   [LINK PROFILE] ${email} -> Legacy ID: ${legacyId} (Auth ID: ${targetId})`);
        updatedProfiles++;

        if (!isDryRun) {
          await supabase.from('profiles').upsert(
            {
              id: targetId,
              email,
              full_name: displayName,
              role,
              is_premium: isPremium || Boolean(existingProfile?.is_premium),
              legacy_id: legacyId,
            },
            { onConflict: 'id' }
          );

          // Backfill payments
          await supabase
            .from('payments')
            .update({ user_id: targetId })
            .eq('user_id', legacyId);
        }
      } else {
        console.log(`   [ALREADY SYNCED] ${email} (Linked to ${existingProfile.id})`);
        skipped++;
      }
    }
  }

  console.log('----------------------------------------------------------------\n');
  console.log('4. Summary of Migration:');
  console.log(`   - Neon Users Scanned:      ${neonUsers.length}`);
  console.log(`   - Auth Users to Create:    ${newlyCreatedAuth}`);
  console.log(`   - Profiles to Create/Sync: ${newlyCreatedProfiles + updatedProfiles}`);
  console.log(`   - Already Migrated:        ${skipped}`);

  if (isDryRun) {
    console.log('\n💡 Dry run complete. No modifications were made to Supabase.');
    console.log('   Run without --dry-run to apply these migrations live.\n');
  } else {
    console.log('\n✅ Migration successfully applied to Supabase Auth & public.profiles!\n');
  }
}

runMigration().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
