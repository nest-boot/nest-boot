import { ApolloDriver } from "@nestjs/apollo";
import { Global, Logger, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { GraphQLModule as BaseGraphQLModule } from "@nestjs/graphql";

import { GraphQLExceptionFilter } from "./graphql.exception-filter";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./graphql.module-definition";
import { type GraphQLModuleOptions } from "./graphql-module-options.interface";

@Global()
@Module({
  imports: [
    BaseGraphQLModule.forRootAsync({
      driver: ApolloDriver,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: GraphQLModuleOptions) => {
        return {
          path: "/api/graphql",
          autoSchemaFile: "schema.gql",
          sortSchema: true,
          graphiql: process.env.NODE_ENV !== "production",
          ...options,
        };
      },
    }),
  ],
  providers: [
    Logger,
    {
      provide: APP_FILTER,
      useClass: GraphQLExceptionFilter,
    },
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: GraphQLModuleOptions = {}) => options,
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN],
})
export class GraphQLModule extends ConfigurableModuleClass {}
