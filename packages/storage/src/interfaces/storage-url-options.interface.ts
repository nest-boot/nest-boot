import { type GetObjectCommandInput } from "@aws-sdk/client-s3";
import { type PresignedPostOptions } from "@aws-sdk/s3-presigned-post";

/** Options for {@link Storage.createTemporaryUrl}. */
export interface StorageTemporaryUrlOptions extends Omit<
  GetObjectCommandInput,
  "Bucket" | "Key"
> {
  /** Signature lifetime in seconds. The AWS SDK defaults to 900 seconds. */
  expiresIn?: number;
}

/** Options for {@link Storage.createTemporaryUploadUrl}. */
export interface StorageTemporaryUploadUrlOptions {
  /** Additional presigned POST policy conditions. */
  conditions?: PresignedPostOptions["Conditions"];

  /** Signature lifetime in seconds. The AWS SDK defaults to 3600 seconds. */
  expiresIn?: number;

  /** Additional form fields included in the presigned POST. */
  fields?: Record<string, string>;
}

/** Temporary upload URL and form fields returned to an uploader. */
export interface StorageTemporaryUpload {
  /** Form fields that must be included in the upload request. */
  fields: Record<string, string>;

  /** Presigned POST destination URL. */
  url: string;
}
