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
