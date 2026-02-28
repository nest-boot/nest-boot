import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ApolloDriver } from "@nestjs/apollo";
import { type DynamicModule, Global, Logger, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { GraphQLModule as BaseGraphQLModule } from "@nestjs/graphql";

import { GraphQLExceptionFilter } from "./graphql.exception-filter";
import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./graphql.module-definition";
import { type GraphQLModuleOptions } from "./graphql-module-options.interface";

/**
 * GraphQL module powered by Apollo Server.
 *
 * @remarks
 * Wraps `@nestjs/graphql` with Apollo driver, providing schema-first
 * auto-generation, playground support, and global exception filtering.
 */
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
          playground: false,
          ...options,
          plugins: [
            ...(options.playground === false
              ? []
              : [ApolloServerPluginLandingPageLocalDefault()]),
            ...(options.plugins ?? []),
          ],
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
      useFactory: (options?: GraphQLModuleOptions) => options ?? {},
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN],
})
export class GraphQLModule extends ConfigurableModuleClass {
  /**
   * Registers the GraphQLModule with the given options.
   * @param options - Apollo Server configuration options
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the GraphQLModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }
}
