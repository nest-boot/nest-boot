import {
  createDynamicController,
  type DynamicControllerOptions,
  Public,
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
 * @returns Dynamic controller mount options; disables the controller when disabled or without JWT.
 */
function resolveDownloadControllerOptions(
  options?: StorageModuleOptions,
  jwt?: JwtService,
): DynamicControllerOptions {
  const download = options?.download;
  if (download?.enabled === false) {
    return { enabled: false };
  }
  const path = resolveStorageDownloadPath(download?.path);
  const decorators = download?.decorators ?? [Public()];
  if (
    !Array.isArray(decorators) ||
    decorators.some((decorator) => typeof decorator !== "function")
  ) {
    throw new Error(
      "Storage download decorators must be an array of class decorators",
    );
  }
  if (!jwt) {
    return { enabled: false };
  }
  return { path, decorators };
}

const downloadController = createDynamicController(StorageDownloadController, {
  inject: [
    { token: MODULE_OPTIONS_TOKEN, optional: true },
    { token: JwtService, optional: true },
  ],
  useFactory: resolveDownloadControllerOptions,
});

/**
 * Global module that provides an S3-backed {@link Storage} service.
 *
 * Import the module directly to read the supported S3 environment variables,
 * or use {@link StorageModule.forRoot} and {@link StorageModule.forRootAsync}
 * for explicit configuration. Exports only {@link Storage} and
 * {@link StorageDownloadService}; the AWS SDK clients remain private
 * implementation details owned by {@link Storage}.
 */
@Global()
@Module({
  controllers: [downloadController.controller],
  providers: [
    storageProvider,
    StorageDownloadService,
    downloadController.provider,
  ],
  exports: [Storage, StorageDownloadService],
})
export class StorageModule extends ConfigurableModuleClass {
  /**
   * Registers the StorageModule with explicit storage options.
   * @param options - Storage configuration
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the StorageModule asynchronously.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }
}
