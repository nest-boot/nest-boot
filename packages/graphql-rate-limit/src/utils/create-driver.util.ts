import { Redis } from "ioredis";

import {
  GraphQLRateLimitDriver,
  MemoryGraphQLRateLimitDriver,
  RedisGraphQLRateLimitDriver,
} from "../drivers/index.js";
import type { GraphQLRateLimitOptions } from "../interfaces/index.js";
import {
  hasRedisConfigFromEnv,
  loadConfigFromEnv,
} from "./load-config-from-env.util.js";

/**
 * Creates the explicitly configured driver or selects a built-in default.
 * @param options - Resolved module options
 * @returns The selected rate limit driver
 * @internal
 */
export function createGraphQLRateLimitDriver(
  options: GraphQLRateLimitOptions,
): GraphQLRateLimitDriver {
  if (options.driver) {
    return options.driver;
  }

  if (!options.connection && !hasRedisConfigFromEnv()) {
    return new MemoryGraphQLRateLimitDriver();
  }

  return new RedisGraphQLRateLimitDriver(
    new Redis({
      ...loadConfigFromEnv(),
      ...options.connection,
    }),
  );
}
