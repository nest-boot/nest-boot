import { parseRedisUrl } from "@nest-boot/redis/connection-options";
import { ConnectionOptions } from "bullmq";

/**
 * Returns redis connection options parsed from the environment.
 * @returns Redis connection options parsed from the environment.
 */
export function loadConfigFromEnv(): ConnectionOptions {
  return process.env.REDIS_URL ? parseRedisUrl(process.env.REDIS_URL) : {};
}
