import { type S3ClientConfig } from "@aws-sdk/client-s3";

/** Configuration options for the global StorageModule. */
export interface StorageModuleOptions {
  /**
   * S3 bucket used for all storage operations.
   *
   * @remarks
   * When omitted, the module reads `S3_BUCKET` from the environment.
   */
  bucket?: string;

  /** AWS SDK configuration used to create the injectable S3 client. */
  client?: S3ClientConfig;

  /** Optional key prefix that scopes every storage path. */
  root?: string;
}
