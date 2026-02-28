import { type DynamicModule, Global, Module } from "@nestjs/common";

import { ConnectionManager } from "./connection.manager";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./graphql-connection.module-definition";

/**
 * NestJS module that provides GraphQL connection-based pagination functionality.
 *
 * This module is global and provides the {@link ConnectionManager} service for
 * executing paginated queries following the Relay connection specification.
 *
 * @example Basic usage
 * ```typescript
 * import { Module } from "@nestjs/common";
 * import { GraphQLConnectionModule } from "@nest-boot/graphql-connection";
 *
 * @Module({
 *   imports: [GraphQLConnectionModule.register()],
 * })
 * export class AppModule {}
 * ```
 *
 * @see {@link ConnectionManager} for executing paginated queries
 * @see {@link ConnectionBuilder} for building connection types
 */
@Global()
@Module({
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class GraphQLConnectionModule extends ConfigurableModuleClass {
  /**
   * Registers the GraphQLConnectionModule with the given options.
   * @param options - Configuration options
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the GraphQLConnectionModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }
}
