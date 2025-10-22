import { Global, Module } from "@nestjs/common";

import { ConnectionManager } from "./connection.manager";
import { ConfigurableModuleClass } from "./graphql-connection.module-definition";

@Global()
@Module({
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class GraphQLConnectionModule extends ConfigurableModuleClass {}
