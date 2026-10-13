import { randomUUID } from 'node:crypto';

import { runMigrations } from 'bullmq';
import { Pool } from 'pg';

/** @returns An isolated PostgreSQL database with the native BullMQ schema. */
export async function createQueueDatabaseFixture() {
  const adminUrl =
    process.env.SERVER_E2E_DATABASE_URL ??
    'postgresql://postgres:secret@127.0.0.1:35432/postgres';
  const database = `queue_rls_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: adminUrl });
  await admin.query(`do $$ begin
    create role authenticated nologin noinherit;
  exception when duplicate_object or unique_violation then null;
  end $$`);
  await admin.query(`create database "${database}"`);
  const url = new URL(adminUrl);
  url.pathname = database;
  const connectionString = url.toString();
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await runMigrations(client);
  } finally {
    client.release();
  }
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
