// Applies db/schema.sql to the Neon database from .env DATABASE_URL.
// Usage: node scripts/apply-schema.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log('Schema applied. Tables:', rows.map(r => r.table_name).join(', '));
} catch (err) {
  console.error('Failed to apply schema:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
