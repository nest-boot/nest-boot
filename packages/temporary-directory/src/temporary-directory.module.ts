import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { RequestContext } from "@nest-boot/request-context";
import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  Optional,
} from "@nestjs/common";

import { resolveBasePath } from "./resolve-base-path";
import { TEMPORARY_DIRECTORY_ROOT } from "./temporary-directory.constants";
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

  /**
   * Creates the module with optional configuration for static imports.
   * @param options - Optional module configuration; absent for static imports
   */
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: TemporaryDirectoryModuleOptions,
  ) {
    super();

    const basePath = resolveBasePath(this.options?.basePath);

    RequestContext.registerMiddleware(
      "temporary-directory",
      async (context, next) => {
        await mkdir(basePath, { recursive: true });
        const root = join(basePath, `nest-boot-${randomUUID()}`);
        await mkdir(root);
        context.set(TEMPORARY_DIRECTORY_ROOT, root);

        try {
          return await next();
        } finally {
          await rm(root, { force: true, recursive: true });
        }
      },
    );
  }
}
