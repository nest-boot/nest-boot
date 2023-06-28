import { type ApolloDriverConfig } from "@nestjs/apollo";
import { type GraphQLWsSubscriptionsConfig } from "@nestjs/graphql";

export interface GraphQLModuleOptions
  extends Omit<ApolloDriverConfig, "subscriptions"> {
  subscriptions: GraphQLWsSubscriptionsConfig | boolean;

  maxComplexity?: number;
  defaultComplexity?: number;
}
