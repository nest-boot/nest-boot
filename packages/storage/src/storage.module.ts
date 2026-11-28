import {
  createDynamicController,
  type DynamicControllerOptions,
  Public,
} from "@nest-boot/common";
import { type DynamicModule, Global, Module } from "@nestjs/common";

import { StorageDownloadController } from "./controllers/storage-download.controller.js";
import { StorageUploadController } from "./controllers/storage-upload.controller.js";
import { type StorageModuleOptions } from "./interfaces/storage-module-options.interface.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./storage.module-definition.js";
import { StorageService } from "./storage.service.js";
import {
  OPTIONAL_JWT_SERVICE_TOKEN,
  type StorageJwtService,
} from "./utils/optional-jwt.util.js";
import {
  DEFAULT_STORAGE_DOWNLOAD_PATH,
  DEFAULT_STORAGE_UPLOAD_PATH,
  resolveStorageRoutePath,
} from "./utils/resolve-storage-route-path.util.js";

/**
 * Validates class decorators passed to a dynamic storage controller.
 * @param decorators - Candidate class decorator array.
 * @param label - Controller label used in error messages.
 */
function assertClassDecorators(
  decorators: ClassDecorator[],
  label: "download" | "upload",
): void {
  if (
    !Array.isArray(decorators) ||
    decorators.some((decorator) => typeof decorator !== "function")
  ) {
    throw new Error(
      `Storage ${label} decorators must be an array of class decorators`,
    );
  }
}

/**
 * Resolves the dynamic controller configuration for signed downloads.
 * @param options - Storage module options, when provided.
 * @param jwt - Optional JWT signer/verifier registered by the host application.
 * @returns Dynamic controller mount options; disables the controller when disabled or without JWT.
 */
function resolveDownloadControllerOptions(
  options?: StorageModuleOptions,
  jwt?: StorageJwtService,
): DynamicControllerOptions {
  const download = options?.download;
  if (download?.enabled === false) {
    return { enabled: false };
  }
  const path = resolveStorageRoutePath(
    download?.path,
    DEFAULT_STORAGE_DOWNLOAD_PATH,
    "download",
  );
  const decorators = download?.decorators ?? [Public()];
  assertClassDecorators(decorators, "download");
  if (!jwt) {
    return { enabled: false };
  }
  return { path, decorators };
}

/**
 * Resolves the dynamic controller configuration for REST temporary file uploads.
 * @param options - Storage module options, when provided.
 * @returns Dynamic controller mount options; disabled unless `upload.enabled` is true.
 */
function resolveUploadControllerOptions(
  options?: StorageModuleOptions,
): DynamicControllerOptions {
  const upload = options?.upload;
  if (!upload?.enabled) {
    return { enabled: false };
  }
  const path = resolveStorageRoutePath(
    upload.path,
    DEFAULT_STORAGE_UPLOAD_PATH,
    "upload",
  );
  const decorators = upload.decorators ?? [];
  assertClassDecorators(decorators, "upload");
  return { path, decorators };
}

const downloadController = createDynamicController(StorageDownloadController, {
  inject: [
    { token: MODULE_OPTIONS_TOKEN, optional: true },
    { token: OPTIONAL_JWT_SERVICE_TOKEN, optional: true },
  ],
  useFactory: resolveDownloadControllerOptions,
});

const uploadController = createDynamicController(StorageUploadController, {
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: resolveUploadControllerOptions,
});

/**
 * Global module that provides an S3-backed {@link StorageService}.
 *
 * Import the module directly to read the supported S3 environment variables,
 * or use {@link StorageModule.forRoot} and {@link StorageModule.forRootAsync}
 * for explicit configuration. Exports only {@link StorageService}; the AWS SDK
 * clients remain private implementation details owned by {@link StorageService}.
 */
@Global()
@Module({
  controllers: [downloadController.controller, uploadController.controller],
  providers: [
    StorageService,
    downloadController.provider,
    uploadController.provider,
  ],
  exports: [StorageService],
})
export class StorageModule extends ConfigurableModuleClass {
  /**
   * Registers the StorageModule with explicit storage options.
   * @param options - Storage configuration.
   * @returns Dynamic module configuration.
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the StorageModule asynchronously.
   * @param options - Async configuration options.
   * @returns Dynamic module configuration.
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }
}
