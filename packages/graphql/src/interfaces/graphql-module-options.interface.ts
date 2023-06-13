import { type ApolloDriverConfig } from "@nestjs/apollo";

export interface GraphQLModuleOptions extends ApolloDriverConfig {
  maxComplexity?: number;
  defaultComplexity?: number;
}
