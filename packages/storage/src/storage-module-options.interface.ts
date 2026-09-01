/** Configuration options for the global StorageModule. */
export interface StorageModuleOptions {
  /**
   * S3 bucket used for all storage operations.
   *
   * @remarks
   * When omitted, the module reads `S3_BUCKET` from the environment.
   */
  bucket?: string;

  /** Optional key prefix that scopes every storage path. */
  root?: string;
}
