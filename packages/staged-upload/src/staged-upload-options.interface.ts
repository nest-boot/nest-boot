/** Defines file size and MIME type constraints for staged uploads. */
export interface StagedUploadLimit {
  /** Maximum file size in bytes. */
  fileSize: number;
  /** Allowed MIME type patterns (supports glob matching via micromatch). */
  mimeTypes: string[];
}

/** Configuration options for the StagedUploadModule. */
export interface StagedUploadModuleOptions {
  /** Optional custom URL prefix for presigned upload URLs. */
  url?: string;
  /** Presigned URL expiration time in seconds (defaults to 3600). */
  expires?: number;
  /** Temporary upload path relative to Storage rootPath (defaults to "/tmp"). */
  temporaryPath?: string;
  /** Persisted upload path relative to Storage rootPath (defaults to "/files"). */
  permanentPath?: string;
  /** Staged upload constraints pairing size and MIME type limits. */
  limits?: StagedUploadLimit[];
}
