import {
  BaseContext,
  GraphQLRequestContextDidResolveOperation,
} from "@apollo/server";
import { type ApolloDriverConfig } from "@nestjs/apollo";
import { type GraphQLWsSubscriptionsConfig } from "@nestjs/graphql";

export interface GraphQLModuleComplexityRateLimitOptions {
  keyPrefix?: string;
  restoreRate?: number;
  maximumAvailable?: number;
  getId?: (
    args: GraphQLRequestContextDidResolveOperation<BaseContext>,
  ) => string;
}

export interface GraphQLModuleComplexityOptions {
  logging?: boolean;
  maxComplexity?: number;
  defaultComplexity?: number;
  rateLimit?: GraphQLModuleComplexityRateLimitOptions | boolean;
}

export interface GraphQLModuleOptions
  extends Omit<ApolloDriverConfig, "subscriptions"> {
  subscriptions?: GraphQLWsSubscriptionsConfig | boolean;
  complexity?: GraphQLModuleComplexityOptions | boolean;
}
