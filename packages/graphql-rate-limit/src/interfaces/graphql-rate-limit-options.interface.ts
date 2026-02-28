import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { RedisOptions } from "ioredis";

/** Configuration options for GraphQL rate limiting. */
export interface GraphQLRateLimitOptions {
  /** Redis connection options for rate limit state storage. */
  connection?: RedisOptions;
  /** Maximum allowed query complexity per request. */
  maxComplexity: number;
  /** Default complexity assigned to fields without explicit `@complexity` directives. */
  defaultComplexity: number;
  /** Redis key prefix for rate limit state. */
  keyPrefix: string;
  /** Rate at which cost budget restores (points per second). */
  restoreRate: number;
  /** Maximum cost budget available per client. */
  maximumAvailable: number;
  /** Function to extract a unique client identifier from the request context. */
  getId: (args: GraphQLRequestContext<BaseContext>) => string;
}
