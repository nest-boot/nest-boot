import { type RedisOptions } from "ioredis";

import { parseRedisUrl } from "../connection-options.js";

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
  return process.env.REDIS_URL ? parseRedisUrl(process.env.REDIS_URL) : {};
}
