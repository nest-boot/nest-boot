import { type RedisOptions } from "ioredis";

function normalizeHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }

  return hostname;
}

/**
 * Checks whether a Redis endpoint is configured in the environment.
 * @returns Whether `REDIS_URL` is present
 * @internal
 */
export function hasRedisConfigFromEnv(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/**
 * Loads Redis connection configuration from environment variables.
 *
 * Supports `REDIS_URL`, which is parsed into ioredis connection options.
 *
 * @returns Redis connection options parsed from environment variables
 */
export function loadConfigFromEnv(): RedisOptions {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const port = url.port;
    const database = url.pathname.split("/")[1];

    return {
      host: normalizeHostname(url.hostname),
      port: port ? +port : undefined,
      db: database ? +database : undefined,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
  }

  return {};
}
