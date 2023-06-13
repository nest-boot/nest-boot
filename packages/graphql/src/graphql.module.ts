import { ApolloDriver } from "@nestjs/apollo";
import { type DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { GraphQLModule as BaseGraphQLModule } from "@nestjs/graphql";

import { GraphQLExceptionFilter } from "./graphql.exception-filter";
import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./graphql.module-definition";
import { type GraphQLModuleOptions } from "./interfaces";
import { ComplexityPlugin } from "./plugins";

@Module({
  providers: [
    ComplexityPlugin,
    {
      provide: APP_FILTER,
      useClass: GraphQLExceptionFilter,
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN],
})
export class GraphQLModule extends ConfigurableModuleClass {
  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return this.withBaseGraphQLModule(super.forRoot(options));
  }

  static forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return this.withBaseGraphQLModule(super.forRootAsync(options));
  }

  private static withBaseGraphQLModule(
    dynamicModule: DynamicModule
  ): DynamicModule {
    const BaseGraphQLDynamicModule = BaseGraphQLModule.forRootAsync({
      driver: ApolloDriver,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: async (options: GraphQLModuleOptions) => {
        return options;
      },
    });

    dynamicModule.imports = [
      ...(dynamicModule.imports ?? []),
      BaseGraphQLDynamicModule,
    ];

    return dynamicModule;
  }
}
