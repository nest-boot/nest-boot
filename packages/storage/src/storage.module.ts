import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from "@nestjs/common";

import { type StorageModuleOptions } from "./interfaces/storage-module-options.interface.js";
import { Storage } from "./storage.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./storage.module-definition.js";
import { loadStorageOptionsFromEnv } from "./utils/load-storage-options-from-env.util.js";

const storageProvider: Provider<Storage> = {
  provide: Storage,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options: StorageModuleOptions = {}): Storage =>
    new Storage(loadStorageOptionsFromEnv(options)),
};

/**
 * Global module that provides an S3-backed {@link Storage} service.
 *
 * @remarks
 * Import the module directly to read the supported S3 environment variables,
 * or use {@link StorageModule.register} and {@link StorageModule.registerAsync}
 * for explicit configuration. The AWS SDK clients are private implementation
 * details owned by {@link Storage}.
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
