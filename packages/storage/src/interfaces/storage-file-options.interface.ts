import { type GetObjectCommandInput } from "@aws-sdk/client-s3";

/** Data accepted by {@link StorageService.uploadFile} and {@link StorageService.uploadTemporaryFile}. */
export type StorageFileData =
  | string
  | NodeJS.ArrayBufferView
  | Iterable<string | NodeJS.ArrayBufferView>
  | AsyncIterable<string | NodeJS.ArrayBufferView>;

/** Object metadata returned by {@link StorageService.statFile}. */
export interface StorageFileStat {
  /** File size in bytes. */
  size: number;

  /** MIME type reported by S3, when present. */
  contentType?: string;

  /** File modification timestamp reported by S3. */
  lastModified?: Date;

  /** File entity tag reported by S3. */
  etag?: string;

  /** User-defined metadata reported by S3, when non-empty. */
  metadata?: Record<string, string>;
}

/** Options for {@link StorageService.readFile}. */
export interface StorageReadFileOptions extends Omit<
  GetObjectCommandInput,
  "Bucket" | "Key"
> {
  /** Character encoding for a string result; omit or use `null` for a Buffer. */
  encoding?: BufferEncoding | null;

  /** Optional signal that aborts the S3 request. */
  signal?: AbortSignal;
}

/** Options for {@link StorageService.createReadStream}. */
export interface StorageReadStreamOptions extends Omit<
  GetObjectCommandInput,
  "Bucket" | "Key" | "Range"
> {
  /** Character encoding applied to emitted stream chunks. */
  encoding?: BufferEncoding;

  /** Inclusive final byte offset. */
  end?: number;

  /** Internal stream buffer size in bytes. */
  highWaterMark?: number;

  /** Optional signal that aborts the S3 request. */
  signal?: AbortSignal;

  /** Inclusive initial byte offset. */
  start?: number;
}
