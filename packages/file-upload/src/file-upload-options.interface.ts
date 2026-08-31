/** Defines file size and MIME type constraints for uploaded files. */
export interface FileUploadLimit {
  /** Maximum file size in bytes. */
  fileSize: number;
  /** Allowed MIME type patterns (supports glob matching via micromatch). */
  mimeTypes: string[];
}

/** Configuration options for the FileUploadModule. */
export interface FileUploadModuleOptions {
  /** Optional custom URL prefix for presigned upload URLs. */
  url?: string;
  /** S3 bucket name for storing uploaded files. */
  bucket: string;
  /** Presigned URL expiration time in seconds (defaults to 3600). */
  expires?: number;
  /** File upload constraints (size and MIME type limits). */
  limits?: FileUploadLimit[];
}
