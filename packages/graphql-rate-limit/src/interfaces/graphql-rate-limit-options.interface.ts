import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { RedisOptions } from "ioredis";

import { GraphQLRateLimitDriver } from "../drivers";

/** Configuration options for GraphQL rate limiting. */
export interface GraphQLRateLimitOptions {
  /**
   * Explicit storage driver. When omitted, Redis is used if `connection`,
   * or `REDIS_URL` is set; otherwise memory is used.
   */
  driver?: GraphQLRateLimitDriver;
  /** Redis options that select and configure the built-in Redis driver. */
  connection?: RedisOptions;
  /** Maximum allowed query complexity per request. */
  maxComplexity: number;
  /** Default complexity assigned to fields without explicit `@complexity` directives. */
  defaultComplexity: number;
  /** Key prefix for rate limit state. */
  keyPrefix: string;
  /** Rate at which cost budget restores (points per second). */
  restoreRate: number;
  /** Maximum cost budget available per client. */
  maximumAvailable: number;
  /** Function to extract a unique client identifier from the request context. */
  getId: (args: GraphQLRequestContext<BaseContext>) => string;
}
