import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { RedisOptions } from "@nest-boot/redis";

export interface GraphQLRateLimitOptions {
  connection?: RedisOptions;
  maxComplexity: number;
  defaultComplexity: number;
  keyPrefix: string;
  restoreRate: number;
  maximumAvailable: number;
  getId: (args: GraphQLRequestContext<BaseContext>) => string;
}
