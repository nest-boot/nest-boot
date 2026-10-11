import { randomUUID } from "node:crypto";

import { runMigrations } from "bullmq";
import { Pool } from "pg";

/**
 * Creates an isolated BullMQ schema using the official migrations.
 * @param schemaName - Optional schema name within the isolated database.
 * @returns Connection options and cleanup for this test suite.
 */
export async function createPostgresFixture(schemaName?: string) {
  const baseConnectionString =
    process.env.QUEUE_TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/postgres";
  const database = `queue_test_${randomUUID().replaceAll("-", "")}`;
  const schema = schemaName ?? database;
  const admin = new Pool({ connectionString: baseConnectionString });
  // Shared request role, also used when generating the Job entity's RLS policy.
  await admin.query(`do $$ begin
    create role authenticated nologin noinherit;
  exception when duplicate_object or unique_violation then null;
  end $$`);
  await admin.query(`create database "${database}"`);
  const url = new URL(baseConnectionString);
  url.pathname = database;
  const connectionString = url.toString();
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await runMigrations(client, schema);
  } finally {
    client.release();
  }
  return {
    connection: { connectionString, schema },
    pool,
    async close() {
      await pool.end();
      await admin.query(`drop database "${database}"`);
      await admin.end();
    },
  };
}
