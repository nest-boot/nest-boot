import { Global, Module } from "@nestjs/common";

import { ConfigurableModuleClass } from "./graphql-logger.module-definition";
import { GraphQLLoggerPlugin } from "./graphql-logger.plugin";

@Global()
@Module({
  providers: [GraphQLLoggerPlugin],
})
export class GraphQLLoggerModule extends ConfigurableModuleClass {}
