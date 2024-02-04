import { Module } from "@nestjs/common";

import { ConnectionManager } from "./connection.manager";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./graphql-connection.module-definition";

@Module({
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class GraphqlConnectionModule extends ConfigurableModuleClass {
  static register(options?: typeof OPTIONS_TYPE) {
    return super.register(options ?? {});
  }

  static registerAsync(options?: typeof ASYNC_OPTIONS_TYPE) {
    return super.registerAsync(options ?? {});
  }
}
