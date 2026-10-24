import { parseRedisUrl } from "@nest-boot/redis/connection-options";
import type { ConnectionOptions } from "bullmq";

/**
 * Reads REDIS_URL; explicit connection options take precedence in BaseQueue.
 * @returns Redis connection options.
 */
export function getRedisConfig(): ConnectionOptions {
  return process.env.REDIS_URL ? parseRedisUrl(process.env.REDIS_URL) : {};
}
