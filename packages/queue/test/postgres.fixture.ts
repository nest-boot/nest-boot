import { randomUUID } from "node:crypto";

import { runMigrations } from "bullmq";
import { Pool } from "pg";

/**
 * Creates an isolated BullMQ schema using the official migrations.
 * @returns Connection options and cleanup for this test suite.
 */
export async function createPostgresFixture() {
  const baseConnectionString =
    process.env.QUEUE_TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/postgres";
  const schema = `queue_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: baseConnectionString });
  const database = schema;
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
      await admin.query(`drop database "${database}" with (force)`);
      await admin.end();
    },
  };
}
