import { RedisOptions } from "ioredis";

/**
 * Loads Redis connection configuration from environment variables.
 *
 * Supports the following environment variables:
 * - `REDIS_URL`: Full Redis connection URL (takes precedence over individual settings)
 * - `REDIS_HOST`: Redis server hostname
 * - `REDIS_PORT`: Redis server port
 * - `REDIS_DB` or `REDIS_DATABASE`: Redis database number
 * - `REDIS_USER` or `REDIS_USERNAME`: Redis username
 * - `REDIS_PASS` or `REDIS_PASSWORD`: Redis password
 * - `REDIS_TLS`: Enable TLS connection (any truthy value)
 *
 * @returns Redis connection options parsed from environment variables
 */
export function loadConfigFromEnv(): RedisOptions {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const port = url.port;
    const database = url.pathname.split("/")[1];

    return {
      host: url.hostname,
      port: port ? +port : undefined,
      db: database ? +database : undefined,
      username: url.username,
      password: url.password,
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
  }

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;
  const database = process.env.REDIS_DB ?? process.env.REDIS_DATABASE;
  const username = process.env.REDIS_USER ?? process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASS ?? process.env.REDIS_PASSWORD;
  const tls = !!process.env.REDIS_TLS;

  return {
    ...(host ? { host } : {}),
    ...(port ? { port: +port } : {}),
    ...(database ? { db: +database } : {}),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(tls ? { tls: {} } : {}),
  };
}
