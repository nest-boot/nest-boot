import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { type ApolloDriverConfig } from "@nestjs/apollo";
import { type GraphQLWsSubscriptionsConfig } from "@nestjs/graphql";
import { RedisOptions } from "ioredis";

export interface GraphQLModuleComplexityRateLimitOptions {
  connection?: RedisOptions;
  keyPrefix?: string;
  restoreRate?: number;
  maximumAvailable?: number;
  getId?: (args: GraphQLRequestContext<BaseContext>) => string;
}

export interface GraphQLModuleComplexityOptions {
  maxComplexity?: number;
  defaultComplexity?: number;
  rateLimit?: GraphQLModuleComplexityRateLimitOptions;
}

export interface GraphQLModuleOptions
  extends Omit<ApolloDriverConfig, "playground" | "subscriptions"> {
  playground?: boolean;
  subscriptions?: GraphQLWsSubscriptionsConfig;
  complexity?: GraphQLModuleComplexityOptions;
}
