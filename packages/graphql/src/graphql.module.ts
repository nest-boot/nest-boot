import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
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
import { type GraphQLModuleOptions } from "./interfaces";
import { ComplexityPlugin } from "./plugins";
import { LoggingPlugin } from "./plugins/logging.plugin";

@Global()
@Module({
  imports: [
    BaseGraphQLModule.forRootAsync({
      driver: ApolloDriver,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: GraphQLModuleOptions) => {
        if (options.playground !== false) {
          options.playground = false;
          options.plugins = [
            ...(options.plugins ?? []),
            ApolloServerPluginLandingPageLocalDefault({
              includeCookies: true,
            }),
          ];
        }

        return {
          path: "/api/graphql",
          autoSchemaFile: true,
          ...options,
          ...(typeof options.subscriptions !== "undefined"
            ? {
                subscriptions: {
                  "graphql-ws": options.subscriptions,
                },
              }
            : {}),
        };
      },
    }),
  ],
  providers: [
    Logger,
    ComplexityPlugin,
    LoggingPlugin,
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
