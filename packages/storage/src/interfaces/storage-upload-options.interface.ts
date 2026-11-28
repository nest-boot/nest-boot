import { type PutObjectCommandInput } from "@aws-sdk/client-s3";

/** Defines file size and MIME type constraints for temporary and URL-based file uploads. */
export interface StorageUploadLimit {
  /** Maximum file size in bytes. */
  fileSize: number;

  /** Allowed MIME type patterns (supports case-insensitive glob matching via picomatch). */
  mimeTypes: readonly string[];
}

/** Configures temporary file upload rules and the optional REST upload route. */
export interface StorageUploadOptions {
  /** Mounts the REST upload endpoint (`POST /uploads` by default). Defaults to false. */
  enabled?: boolean;

  /** Static route path under the Nest global prefix for the REST upload endpoint. Defaults to `/uploads`. */
  path?: string;

  /**
   * Class decorators applied to the upload controller, defaulting to `[]`.
   *
   * Supports both metadata decorators (such as `Public()` or `SkipThrottle()`) and
   * Nest enhancers (`@UseGuards`, `@UseInterceptors`, `@UsePipes`, `@UseFilters`).
   */
  decorators?: ClassDecorator[];

  /** Presigned upload and temporary resource URL expiration in seconds. Defaults to 86,400 (one day). */
  expiresIn?: number;

  /**
   * Default timeout in milliseconds for server-side upload operations
   * (`uploadFile`, `uploadTemporaryFile`, and `uploadFileFromUrl`). Defaults to 30,000 ms.
   */
  timeout?: number;

  /**
   * Ordered MIME type and byte-size rules enforced on `createTemporaryFileUploadUrl`
   * and by default on `uploadFileFromUrl` (first matching MIME rule wins).
   * Defaults to `DEFAULT_STORAGE_UPLOAD_LIMITS`.
   */
  limits?: readonly StorageUploadLimit[];
}

/** One form field required by a presigned temporary file upload request. */
export interface StorageTemporaryFileUploadField {
  /** Form field name. */
  name: string;

  /** Form field value. */
  value: string;
}

/** File metadata used to request a temporary file upload URL. */
export interface StorageTemporaryFileUploadRequest {
  /** Original file name including its extension. */
  name: string;

  /** File size in bytes. */
  fileSize: number;

  /** MIME type reported for the file. */
  mimeType: string;
}

/** Presigned POST upload target and temporary online resource URL returned to an uploader. */
export interface StorageTemporaryFileUploadUrl {
  /** Presigned POST destination URL where the multipart form must be submitted. */
  url: string;

  /** Temporary presigned GET URL for previewing the uploaded file and passing to {@link StorageService.uploadFileFromUrl}. */
  resourceUrl: string;

  /** Form fields that must accompany the multipart POST upload. */
  fields: StorageTemporaryFileUploadField[];
}

/** Options for {@link StorageService.uploadFileFromUrl}. */
export interface StorageUploadFileFromUrlOptions {
  /** Allowed MIME type glob patterns (via picomatch) overriding `upload.limits` for this call. */
  allowedMimeTypes?: readonly string[];

  /** Explicit file extension override when uploading from a URL (for example `"png"` or `".png"`). */
  extension?: string;

  /** Maximum allowed file size in bytes, overriding the matched `upload.limits` rule for this call. */
  maxFileSize?: number;

  /** Optional signal that aborts external HTTP fetching and S3 upload. */
  signal?: AbortSignal;

  /** Total upload timeout in milliseconds covering external URL fetching and S3 persistence. Overrides `upload.timeout` for this call. */
  timeout?: number;
}

/** Options for {@link StorageService.uploadFile} and {@link StorageService.uploadTemporaryFile}. */
export interface StorageUploadFileOptions extends Omit<
  PutObjectCommandInput,
  "Body" | "Bucket" | "ContentType" | "Key"
> {
  /** MIME type stored as S3 `ContentType` and used to infer the file extension when `extension` is omitted. */
  contentType: string;

  /** Explicit file extension (for example `"png"` or `".png"`). */
  extension?: string;

  /** Character encoding used when the input data is a string. */
  encoding?: BufferEncoding;

  /** Keep uploaded multipart pieces when the upload fails. Defaults to false. */
  leavePartsOnError?: boolean;

  /** Multipart upload part size in bytes. The AWS minimum is 5 MiB. */
  partSize?: number;

  /** Number of multipart upload parts processed concurrently. Defaults to 4. */
  queueSize?: number;

  /** Optional signal that aborts the upload. */
  signal?: AbortSignal;

  /** Upload timeout in milliseconds. Overrides `upload.timeout` for this call. */
  timeout?: number;
}
