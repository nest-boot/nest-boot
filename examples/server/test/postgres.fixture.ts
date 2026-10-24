import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

/** @returns An empty, isolated PostgreSQL database for example migration tests. */
export async function createDatabaseFixture() {
  const adminUrl =
    process.env.SERVER_E2E_DATABASE_URL ??
    'postgresql://postgres:secret@127.0.0.1:35432/postgres';
  const database = `example_baseline_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: adminUrl });
  await admin.query(`create database "${database}"`);
  const url = new URL(adminUrl);
  url.pathname = database;
  const connectionString = url.toString();
  const pool = new Pool({ connectionString });
  return {
    connectionString,
    pool,
    async close() {
      await pool.end();
      await admin.query(`drop database "${database}"`);
      await admin.end();
    },
  };
}
