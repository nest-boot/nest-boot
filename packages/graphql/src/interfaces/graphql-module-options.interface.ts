import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { ApolloServerPluginLandingPageGraphQLPlaygroundOptions } from "@apollo/server-plugin-landing-page-graphql-playground";
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
  /**
   * @deprecated GraphQL Playground 项目已停止使用，推荐使用 ApolloServerPluginLandingPageLocalDefault 插件来替代。
   */
  playground?: boolean | ApolloServerPluginLandingPageGraphQLPlaygroundOptions;
  subscriptions?: GraphQLWsSubscriptionsConfig;
  complexity?: GraphQLModuleComplexityOptions;
}
