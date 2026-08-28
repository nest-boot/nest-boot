import { RedisOptions } from "ioredis";

/**
 * Loads Redis configuration from environment variables.
 *
 * Supports `REDIS_URL`, a full Redis connection URL. The URL is parsed here
 * instead of being passed to ioredis so all environment-driven connections
 * use the same options shape.
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
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
  }

  return {};
}
