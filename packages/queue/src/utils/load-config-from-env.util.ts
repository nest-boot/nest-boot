import type { PostgresConnectionOptions } from "bullmq";

/**
 * Reads the queue database URL, falling back to the application's database URL.
 * @returns PostgreSQL connection options; omitted fields use node-postgres defaults.
 */
export function loadConfigFromEnv(): PostgresConnectionOptions {
  const queueUrl = process.env.QUEUE_DATABASE_URL;
  const connectionString =
    (queueUrl === "" ? undefined : queueUrl) ?? process.env.DATABASE_URL;
  return connectionString ? { connectionString } : {};
}
