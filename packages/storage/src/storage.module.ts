import { S3Client } from "@aws-sdk/client-s3";
import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from "@nestjs/common";

import { Storage } from "./storage.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./storage.module-definition.js";
import { type StorageModuleOptions } from "./storage-module-options.interface.js";

const storageProvider: Provider<Storage> = {
  provide: Storage,
  inject: [S3Client, { token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (
    s3Client: S3Client,
    options: StorageModuleOptions = {},
  ): Storage =>
    new Storage(s3Client, {
      ...options,
      bucket: options.bucket ?? process.env.S3_BUCKET,
    }),
};

/**
 * Global module that provides an S3-backed {@link Storage} service.
 *
 * @remarks
 * Register `S3Module` once before using this module. Import the module directly
 * to read `S3_BUCKET`, or use {@link StorageModule.register} and
 * {@link StorageModule.registerAsync} for explicit configuration.
 */
@Global()
@Module({ providers: [storageProvider], exports: [Storage] })
export class StorageModule extends ConfigurableModuleClass {
  /**
   * Registers the StorageModule with explicit storage options.
   * @param options - Storage configuration
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the StorageModule asynchronously.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }
}
