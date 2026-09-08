import { q, sendJson, type Handler } from './_lib';

/**
 * Health check: confirms the functions boot, the environment variables are
 * present, and the database is reachable. Reports booleans/status only — never
 * secret values.
 */
const handler: Handler = async (_req, res) => {
  let database: string;
  try {
    await q('SELECT 1 AS ok');
    database = 'reachable';
  } catch {
    database = 'unreachable';
  }
  sendJson(res, 200, {
    ok: true,
    env: {
      databaseUrl: Boolean(process.env.DATABASE_URL),
      authSecret: Boolean(process.env.AUTH_SECRET),
    },
    database,
  });
};

export default handler;
