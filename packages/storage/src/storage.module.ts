import {
  createDynamicController,
  type DynamicControllerOptions,
  withDynamicController,
} from "@nest-boot/common";
import { JwtService } from "@nest-boot/jwt";
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
  useFactory: (options?: StorageModuleOptions) =>
    new Storage(loadStorageOptionsFromEnv(options)),
};

/**
 * Resolves the dynamic controller configuration for signed downloads.
 * @param options - Storage module options, when provided.
 * @param jwt - Optional JWT signer/verifier registered by the host application.
 * @returns Dynamic controller mount options; omits the route when disabled or without JWT.
 */
function resolveDownloadControllerOptions(
  options?: StorageModuleOptions,
  jwt?: JwtService,
): DynamicControllerOptions {
  const download = options?.download;
  if (download?.enabled === false) {
    return { path: [] };
  }
  const path = resolveStorageDownloadPath(download?.path);
  if (!jwt) {
    return { path: [] };
  }
  return {
    path,
    decorators: download?.controllerDecorator
      ? [download.controllerDecorator]
      : [],
  };
}

const directDownloadController = createDynamicController(
  StorageDownloadController,
  {
    inject: [
      { token: MODULE_OPTIONS_TOKEN, optional: true },
      { token: JwtService, optional: true },
    ],
    useFactory: resolveDownloadControllerOptions,
  },
);

@Global()
@Module({ providers: [storageProvider], exports: [Storage] })
class StorageCoreModule extends ConfigurableModuleClass {}

/**
 * Global module that provides an S3-backed {@link Storage} service.
 *
 * Exports only {@link Storage} and {@link StorageDownloadService}; the raw S3
 * client instances remain internal implementation details owned by {@link Storage}.
 */
@Global()
@Module({
  controllers: [directDownloadController.controller],
  providers: [
    storageProvider,
    StorageDownloadService,
    directDownloadController.provider,
  ],
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
   * Registers the StorageModule using asynchronously resolved options.
   * @param options - Async factory or provider options for storage configuration
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
        inject: [MODULE_OPTIONS_TOKEN, { token: JwtService, optional: true }],
        useFactory: resolveDownloadControllerOptions,
      },
    );
  }
}
