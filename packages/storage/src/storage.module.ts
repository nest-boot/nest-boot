import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
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

const STORAGE_URL_S3_CLIENT = Symbol("STORAGE_URL_S3_CLIENT");
const STORAGE_PUBLIC_URL_S3_CLIENT = Symbol("STORAGE_PUBLIC_URL_S3_CLIENT");

const s3ClientProvider: Provider<S3Client> = {
  provide: S3Client,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options: StorageModuleOptions = {}) =>
    new S3Client(createS3ClientConfig(options)),
};

const s3UrlClientProvider: Provider<S3Client> = {
  provide: STORAGE_URL_S3_CLIENT,
  inject: [S3Client, { token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (
    s3Client: S3Client,
    options: StorageModuleOptions = {},
  ): S3Client => {
    const resolvedOptions = loadStorageOptionsFromEnv(options);
    const internalEndpointUrl =
      resolvedOptions.internalEndpointUrl ?? resolvedOptions.endpointUrl;
    const endpointUrl =
      resolvedOptions.endpointUrl ?? resolvedOptions.internalEndpointUrl;

    return !endpointUrl || endpointUrl === internalEndpointUrl
      ? s3Client
      : new S3Client(createS3ClientConfig(resolvedOptions, endpointUrl));
  },
};

const s3PublicUrlClientProvider: Provider<S3Client> = {
  provide: STORAGE_PUBLIC_URL_S3_CLIENT,
  inject: [
    S3Client,
    STORAGE_URL_S3_CLIENT,
    { token: MODULE_OPTIONS_TOKEN, optional: true },
  ],
  useFactory: (
    s3Client: S3Client,
    s3UrlClient: S3Client,
    options: StorageModuleOptions = {},
  ): S3Client => {
    const resolvedOptions = loadStorageOptionsFromEnv(options);
    const internalEndpointUrl =
      resolvedOptions.internalEndpointUrl ?? resolvedOptions.endpointUrl;
    const endpointUrl =
      resolvedOptions.endpointUrl ?? resolvedOptions.internalEndpointUrl;
    const publicEndpointUrl = resolvedOptions.publicEndpointUrl ?? endpointUrl;

    if (!publicEndpointUrl || publicEndpointUrl === endpointUrl) {
      return s3UrlClient;
    }
    if (publicEndpointUrl === internalEndpointUrl) {
      return s3Client;
    }

    return new S3Client(
      createS3ClientConfig(resolvedOptions, publicEndpointUrl),
    );
  },
};

const storageProvider: Provider<Storage> = {
  provide: Storage,
  inject: [
    S3Client,
    STORAGE_URL_S3_CLIENT,
    STORAGE_PUBLIC_URL_S3_CLIENT,
    { token: MODULE_OPTIONS_TOKEN, optional: true },
  ],
  useFactory: (
    s3Client: S3Client,
    s3UrlClient: S3Client,
    s3PublicUrlClient: S3Client,
    options: StorageModuleOptions = {},
  ): Storage =>
    new Storage(
      s3Client,
      loadStorageOptionsFromEnv(options),
      s3UrlClient,
      s3PublicUrlClient,
    ),
};

function createS3ClientConfig(
  options: StorageModuleOptions,
  endpointUrl?: string,
): S3ClientConfig {
  const resolvedOptions = loadStorageOptionsFromEnv(options);
  const { accessKeyId, forcePathStyle, region, secretAccessKey } =
    resolvedOptions;
  const resolvedEndpointUrl =
    endpointUrl ??
    resolvedOptions.internalEndpointUrl ??
    resolvedOptions.endpointUrl;

  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      "Storage credentials require both accessKeyId and secretAccessKey",
    );
  }

  return {
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    ...(resolvedEndpointUrl ? { endpoint: resolvedEndpointUrl } : {}),
    ...(forcePathStyle === undefined ? {} : { forcePathStyle }),
    ...(region ? { region } : {}),
  };
}

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
  providers: [
    s3ClientProvider,
    s3UrlClientProvider,
    s3PublicUrlClientProvider,
    storageProvider,
  ],
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
   * @param s3UrlClient - Client used for direct and temporary upload URLs
   * @param s3PublicUrlClient - Client used for temporary download URLs
   */
  constructor(
    private readonly s3Client: S3Client,
    @Inject(STORAGE_URL_S3_CLIENT)
    private readonly s3UrlClient: S3Client,
    @Inject(STORAGE_PUBLIC_URL_S3_CLIENT)
    private readonly s3PublicUrlClient: S3Client,
  ) {
    super();
  }

  /** Releases resources held by the AWS SDK client. */
  onApplicationShutdown(): void {
    for (const client of new Set([
      this.s3Client,
      this.s3UrlClient,
      this.s3PublicUrlClient,
    ])) {
      client.destroy();
    }
  }
}
