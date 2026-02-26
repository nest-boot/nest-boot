import { Global, Module } from "@nestjs/common";

import { ConnectionManager } from "./connection.manager";
import { ConfigurableModuleClass } from "./graphql-connection.module-definition";

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
 *   imports: [GraphQLConnectionModule.forRoot()],
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
export class GraphQLConnectionModule extends ConfigurableModuleClass {}
