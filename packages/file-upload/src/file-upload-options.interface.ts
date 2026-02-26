import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

/**
 * Restrictions for file uploads.
 */
export interface FileUploadLimit {
  /**
   * Maximum file size in bytes.
   */
  fileSize: number;

  /**
   * Allowed MIME types (supports wildcards, e.g., 'image/*').
   */
  mimeTypes: string[];
}

/**
 * Options for configuring the FileUploadModule.
 */
export interface FileUploadModuleOptions {
  /**
   * AWS S3 Client instance or configuration object.
   */
  client: S3Client | S3ClientConfig;

  /**
   * Optional custom URL for the S3 bucket (e.g. for CDN or proxy).
   */
  url?: string;

  /**
   * The S3 bucket name.
   */
  bucket: string;

  /**
   * Expiration time for presigned URLs in seconds.
   * Default: 3600
   */
  expires?: number;

  /**
   * File upload limits.
   */
  limits?: FileUploadLimit[];
}
