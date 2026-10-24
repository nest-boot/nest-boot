import { randomUUID } from "node:crypto";

import { Pool } from "pg";

/**
 * Creates an isolated PostgreSQL database for Job history tests.
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
  // Shared request role used by application session-context integration tests.
  await admin.query(`do $$ begin
    create role authenticated nologin noinherit;
  exception when duplicate_object or unique_violation then null;
  end $$`);
  await admin.query(`create database "${database}"`);
  const url = new URL(baseConnectionString);
  url.pathname = database;
  const connectionString = url.toString();
  const pool = new Pool({ connectionString });

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
