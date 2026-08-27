import { RedisOptions } from "ioredis";

const REDIS_ENVIRONMENT_VARIABLES = [
  "REDIS_URL",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_DB",
  "REDIS_DATABASE",
  "REDIS_USER",
  "REDIS_USERNAME",
  "REDIS_PASS",
  "REDIS_PASSWORD",
  "REDIS_TLS",
] as const;

/**
 * Checks whether any supported Redis environment variable is configured.
 * @returns Whether environment-driven Redis configuration is present
 * @internal
 */
export function hasRedisConfigFromEnv(): boolean {
  return REDIS_ENVIRONMENT_VARIABLES.some((name) => !!process.env[name]);
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
