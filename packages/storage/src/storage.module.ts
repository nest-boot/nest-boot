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
const STORAGE_BUCKET_ENDPOINT_S3_CLIENT = Symbol(
  "STORAGE_BUCKET_ENDPOINT_S3_CLIENT",
);

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

const s3BucketEndpointClientProvider: Provider<S3Client> = {
  provide: STORAGE_BUCKET_ENDPOINT_S3_CLIENT,
  inject: [
    STORAGE_URL_S3_CLIENT,
    { token: MODULE_OPTIONS_TOKEN, optional: true },
  ],
  useFactory: (
    s3UrlClient: S3Client,
    options: StorageModuleOptions = {},
  ): S3Client => {
    const resolvedOptions = loadStorageOptionsFromEnv(options);
    const { bucketEndpointUrl } = resolvedOptions;

    if (!bucketEndpointUrl) {
      return s3UrlClient;
    }

    return new S3Client(
      createS3ClientConfig(resolvedOptions, bucketEndpointUrl, true),
    );
  },
};

const storageProvider: Provider<Storage> = {
  provide: Storage,
  inject: [
    S3Client,
    STORAGE_URL_S3_CLIENT,
    STORAGE_BUCKET_ENDPOINT_S3_CLIENT,
    { token: MODULE_OPTIONS_TOKEN, optional: true },
  ],
  useFactory: (
    s3Client: S3Client,
    s3UrlClient: S3Client,
    s3BucketEndpointClient: S3Client,
    options: StorageModuleOptions = {},
  ): Storage =>
    new Storage(
      s3Client,
      loadStorageOptionsFromEnv(options),
      s3UrlClient,
      s3BucketEndpointClient,
    ),
};

function createS3ClientConfig(
  options: StorageModuleOptions,
  endpointUrl?: string,
  bucketEndpoint = false,
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
    ...(bucketEndpoint ? { bucketEndpoint: true } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    ...(resolvedEndpointUrl ? { endpoint: resolvedEndpointUrl } : {}),
    ...(bucketEndpoint || forcePathStyle === undefined
      ? {}
      : { forcePathStyle }),
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
    s3BucketEndpointClientProvider,
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
   * @param s3BucketEndpointClient - Client used for bucket-endpoint download URLs
   */
  constructor(
    private readonly s3Client: S3Client,
    @Inject(STORAGE_URL_S3_CLIENT)
    private readonly s3UrlClient: S3Client,
    @Inject(STORAGE_BUCKET_ENDPOINT_S3_CLIENT)
    private readonly s3BucketEndpointClient: S3Client,
  ) {
    super();
  }

  /** Releases resources held by the AWS SDK client. */
  onApplicationShutdown(): void {
    for (const client of new Set([
      this.s3Client,
      this.s3UrlClient,
      this.s3BucketEndpointClient,
    ])) {
      client.destroy();
    }
  }
}
