// Production diagnostics: confirms the API functions load, which environment
// variables are present (values are never exposed) and whether Neon or Cloud Store is active.
export default async function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  const health = {
    ok: true,
    functionRuntime: 'node',
    databaseUrl: Boolean(process.env.DATABASE_URL),
    authSecret: Boolean(process.env.AUTH_SECRET),
    supabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    flwConfigured: Boolean(process.env.FLW_SECRET_KEY),
    timestamp: new Date().toISOString(),
  };

  try {
    const { getPool, syncStoreFromCloud } = await import('./_lib.mjs');
    const pool = await getPool();
    await pool.query('SELECT 1');
    health.database = 'reachable';
  } catch (err) {
    try {
      const { syncStoreFromCloud } = await import('./_lib.mjs');
      await syncStoreFromCloud(true);
      health.ok = true;
      health.database = 'cloud-store-active';
      health.neonNotice = err && err.message ? err.message.slice(0, 200) : 'quota fallback active';
    } catch (cloudErr) {
      health.ok = false;
      health.database = 'error';
      health.databaseError = err && err.message ? err.message.slice(0, 200) : 'unknown error';
    }
  }

  res.end(JSON.stringify(health));
}
