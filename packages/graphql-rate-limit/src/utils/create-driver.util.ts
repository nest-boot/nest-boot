import Redis from "ioredis";

import {
  GraphQLRateLimitDriver,
  MemoryGraphQLRateLimitDriver,
  RedisGraphQLRateLimitDriver,
} from "../drivers";
import { GraphQLRateLimitOptions } from "../interfaces";

/**
 * Creates the explicitly configured driver or selects a built-in default.
 * @param options - Resolved module options
 * @param redis - Shared client provided by RedisModule, when registered
 * @returns The selected rate limit driver
 * @internal
 */
export function createGraphQLRateLimitDriver(
  options: GraphQLRateLimitOptions,
  redis?: Redis,
): GraphQLRateLimitDriver {
  if (options.driver) {
    return options.driver;
  }

  if (options.connection) {
    return new RedisGraphQLRateLimitDriver(new Redis(options.connection));
  }

  if (redis) {
    return new RedisGraphQLRateLimitDriver(redis, false);
  }

  return new MemoryGraphQLRateLimitDriver();
}
