import { RedisOptions } from "ioredis";

/**
 * Checks whether a Redis endpoint is configured in the environment.
 * @returns Whether `REDIS_URL` or `REDIS_HOST` is present
 * @internal
 */
export function hasRedisConfigFromEnv(): boolean {
  return [process.env.REDIS_URL, process.env.REDIS_HOST].some(Boolean);
}

/**
 * Loads Redis connection configuration from environment variables.
 *
 * Supports the same variables and aliases as `@nest-boot/redis`. `REDIS_URL`
 * takes precedence over individual settings.
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
    host,
    ...(port ? { port: +port } : {}),
    ...(database ? { db: +database } : {}),
    username,
    password,
    ...(tls ? { tls: {} } : {}),
  };
}
