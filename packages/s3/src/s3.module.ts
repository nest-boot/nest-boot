import { S3Client } from "@aws-sdk/client-s3";
import {
  type DynamicModule,
  Global,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./s3.module-definition.js";
import { type S3ModuleOptions } from "./s3-module-options.type.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";

const s3ClientProvider: Provider<S3Client> = {
  provide: S3Client,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options: S3ModuleOptions = {}) =>
    new S3Client({
      ...loadConfigFromEnv(),
      ...options,
    }),
};

/**
 * Global module that provides a configured AWS SDK S3 client.
 *
 * @remarks
 * Import the module directly to load the supported S3 environment variables,
 * or use {@link S3Module.register} and {@link S3Module.registerAsync} to
 * override them with explicit client options.
 */
@Global()
@Module({ providers: [s3ClientProvider], exports: [S3Client] })
export class S3Module
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
  /**
   * Registers the S3Module with explicit AWS SDK client options.
   * @param options - AWS S3 client configuration
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the S3Module asynchronously.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }

  /**
   * Creates an S3Module instance.
   * @param s3Client - The global AWS SDK S3 client
   */
  constructor(private readonly s3Client: S3Client) {
    super();
  }

  /** Releases resources held by the AWS SDK client. */
  onApplicationShutdown(): void {
    this.s3Client.destroy();
  }
}
