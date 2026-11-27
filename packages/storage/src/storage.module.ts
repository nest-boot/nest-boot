import { withDynamicController } from "@nest-boot/common";
import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from "@nestjs/common";

import { StorageDownloadController } from "./controllers/storage-download.controller.js";
import { type StorageModuleOptions } from "./interfaces/storage-module-options.interface.js";
import { StorageDownloadService } from "./services/storage-download.service.js";
import { Storage } from "./storage.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./storage.module-definition.js";
import { loadStorageOptionsFromEnv } from "./utils/load-storage-options-from-env.util.js";
import { resolveStorageDownloadPath } from "./utils/resolve-storage-download-path.util.js";

const storageProvider: Provider<Storage> = {
  provide: Storage,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options: StorageModuleOptions = {}): Storage =>
    new Storage(loadStorageOptionsFromEnv(options)),
};

@Global()
@Module({ providers: [storageProvider], exports: [Storage] })
class StorageCoreModule extends ConfigurableModuleClass {}

/**
 * Global module that provides an S3-backed {@link Storage} service.
 *
 * Import the module directly to read the supported S3 environment variables,
 * or use {@link StorageModule.forRoot} and {@link StorageModule.forRootAsync}
 * for explicit configuration. The AWS SDK clients are private implementation
 * details owned by {@link Storage}.
 */
@Global()
@Module({
  controllers: [StorageDownloadController],
  providers: [storageProvider, StorageDownloadService],
  exports: [Storage, StorageDownloadService],
})
export class StorageModule extends StorageCoreModule {
  /**
   * Registers the StorageModule with explicit storage options.
   * @param options - Storage configuration
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return this.withDownloadController(super.forRoot(options));
  }

  /**
   * Registers the StorageModule asynchronously.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return this.withDownloadController(super.forRootAsync(options));
  }

  private static withDownloadController(
    definition: DynamicModule,
  ): DynamicModule {
    return withDynamicController(
      {
        ...definition,
        module: StorageCoreModule,
        providers: [...(definition.providers ?? []), StorageDownloadService],
        exports: [StorageDownloadService],
      },
      StorageDownloadController,
      {
        inject: [MODULE_OPTIONS_TOKEN],
        useFactory: ({ download }: StorageModuleOptions) =>
          download?.enabled === false
            ? { path: [] }
            : {
                path: resolveStorageDownloadPath(download?.path),
                decorators: download?.controllerDecorator
                  ? [download.controllerDecorator]
                  : [],
              },
      },
    );
  }
}
