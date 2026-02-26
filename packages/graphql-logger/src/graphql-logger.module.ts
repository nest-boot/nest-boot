import { Global, Module } from "@nestjs/common";

import { ConfigurableModuleClass } from "./graphql-logger.module-definition";
import { GraphQLLoggerPlugin } from "./graphql-logger.plugin";

/**
 * Module that provides logging for GraphQL requests.
 * It registers an Apollo Server plugin that logs operation details.
 */
@Global()
@Module({
  providers: [GraphQLLoggerPlugin],
})
export class GraphQLLoggerModule extends ConfigurableModuleClass {}
