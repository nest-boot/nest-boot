import { Module } from "@nestjs/common";

import { ConnectionManager } from "./connection.manager";
import { ConfigurableModuleClass } from "./graphql-connection.module-definition";

@Module({
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class GraphqlConnectionModule extends ConfigurableModuleClass {}
