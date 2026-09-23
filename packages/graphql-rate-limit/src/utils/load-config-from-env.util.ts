import { parseRedisUrl } from "@nest-boot/redis/connection-options";
import { type RedisOptions } from "ioredis";

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
  return process.env.REDIS_URL ? parseRedisUrl(process.env.REDIS_URL) : {};
}
