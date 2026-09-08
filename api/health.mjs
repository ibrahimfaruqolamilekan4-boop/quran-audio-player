// Production diagnostics: confirms the API functions load, which environment
// variables are present (values are never exposed) and whether Neon is
// reachable. Plain ESM JavaScript with no imports so it can never fail because
// of a module-resolution problem.
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
    const { getPool } = await import('./_lib.mjs');
    const pool = await getPool();
    await pool.query('SELECT 1');
    health.database = 'reachable';
  } catch (err) {
    health.ok = false;
    health.database = 'error';
    // Never leak credentials; the message alone is enough to diagnose.
    health.databaseError = err && err.message ? err.message.slice(0, 200) : 'unknown error';
  }

  res.end(JSON.stringify(health));
}
