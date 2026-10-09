import { parseRedisUrl } from "@nest-boot/redis/connection-options";
import { ConnectionOptions } from "bullmq";

export function loadConfigFromEnv(): ConnectionOptions {
  return process.env.REDIS_URL ? parseRedisUrl(process.env.REDIS_URL) : {};
}
