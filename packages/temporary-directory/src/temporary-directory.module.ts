import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  Optional,
} from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./temporary-directory.module-definition";
import { TemporaryDirectoryService } from "./temporary-directory.service";
import { type TemporaryDirectoryModuleOptions } from "./temporary-directory-module-options.interface";

/** Provides request-context-scoped temporary directories. */
@Global()
@Module({
  providers: [TemporaryDirectoryService],
  exports: [TemporaryDirectoryService],
})
export class TemporaryDirectoryModule extends ConfigurableModuleClass {
  /** Registers the module with synchronous configuration. */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /** Registers the module with asynchronous configuration. */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }

  /** Creates the module with optional configuration for static imports. */
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    protected readonly options?: TemporaryDirectoryModuleOptions,
  ) {
    super();
  }
}
