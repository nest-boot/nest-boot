/** Configuration options for the global StorageModule and its S3 client. */
export interface StorageModuleOptions {
  /** Access key used for S3-compatible authentication. */
  accessKeyId?: string;

  /**
   * S3 bucket used for all storage operations.
   *
   * @remarks
   * When omitted, the module reads `STORAGE_BUCKET` from the environment.
   */
  bucket?: string;

  /**
   * Whether `endpointUrl` already identifies the configured bucket.
   * Trailing slashes in the endpoint path are normalized when enabled.
   */
  bucketEndpoint?: boolean;

  /** External S3 endpoint used for uploads and as the public URL fallback. */
  endpointUrl?: string;

  /** Whether requests use path-style bucket addressing. */
  forcePathStyle?: boolean;

  /** Internal S3-compatible endpoint used for server-side object operations. */
  internalEndpointUrl?: string;

  /**
   * Whether `internalEndpointUrl` already identifies the configured bucket.
   * Defaults to `bucketEndpoint` when omitted.
   * Trailing slashes in the endpoint path are normalized when enabled.
   */
  internalBucketEndpoint?: boolean;

  /** AWS region used for signing and endpoint resolution. */
  region?: string;

  /**
   * Optional key prefix that scopes every storage path. Defaults to the bucket
   * root (`/`), represented internally by an empty prefix.
   *
   * @remarks
   * When omitted, the module reads `STORAGE_ROOT_PATH` from the environment.
   */
  rootPath?: string;

  /** Secret access key used for S3-compatible authentication. */
  secretAccessKey?: string;
}
