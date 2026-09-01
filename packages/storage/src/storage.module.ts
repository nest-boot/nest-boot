import { S3Client } from "@aws-sdk/client-s3";
import {
  type DynamicModule,
  Global,
  Module,
  type OnApplicationShutdown,
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
import { loadS3ConfigFromEnv } from "./utils/load-s3-config-from-env.util.js";

const s3ClientProvider: Provider<S3Client> = {
  provide: S3Client,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options: StorageModuleOptions = {}) =>
    new S3Client({
      ...loadS3ConfigFromEnv(),
      ...options.client,
    }),
};

const storageProvider: Provider<Storage> = {
  provide: Storage,
  inject: [S3Client, { token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (
    s3Client: S3Client,
    options: StorageModuleOptions = {},
  ): Storage =>
    new Storage(s3Client, {
      bucket: options.bucket ?? process.env.S3_BUCKET,
      root: options.root,
    }),
};

/**
 * Global module that provides an S3-backed {@link Storage} service.
 *
 * @remarks
 * Import the module directly to read the supported S3 environment variables,
 * or use {@link StorageModule.register} and {@link StorageModule.registerAsync}
 * for explicit configuration. The module globally exports both the AWS SDK
 * `S3Client` and {@link Storage}.
 */
@Global()
@Module({
  providers: [s3ClientProvider, storageProvider],
  exports: [S3Client, Storage],
})
export class StorageModule
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
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

  /**
   * Creates a StorageModule instance.
   * @param s3Client - The globally injectable AWS SDK S3 client
   */
  constructor(private readonly s3Client: S3Client) {
    super();
  }

  /** Releases resources held by the AWS SDK client. */
  onApplicationShutdown(): void {
    this.s3Client.destroy();
  }
}
