import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./graphql-logger.module-definition";
import { GraphQLLoggerPlugin } from "./graphql-logger.plugin";

/**
 * GraphQL request logging module.
 *
 * @remarks
 * Provides an Apollo Server plugin that logs GraphQL operations
 * including query details, variables, and execution timing.
 */
@Global()
@Module({
  providers: [GraphQLLoggerPlugin],
})
export class GraphQLLoggerModule extends ConfigurableModuleClass {
  /**
   * Registers the GraphQLLoggerModule with the given options.
   * @param options - Configuration options for GraphQL logging
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the GraphQLLoggerModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }
}
