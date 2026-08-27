import { RedisOptions } from "ioredis";

/**
 * Loads Redis connection configuration from environment variables.
 *
 * @param redisUrl - Full Redis connection URL from `REDIS_URL`
 * @returns Redis connection options parsed from environment variables
 */
export function loadConfigFromEnv(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
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
