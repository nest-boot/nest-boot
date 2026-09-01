import {
  type GetObjectCommandInput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

/** Data accepted by {@link Storage.writeFile}. */
export type StorageFileData =
  | string
  | NodeJS.ArrayBufferView
  | Iterable<string | NodeJS.ArrayBufferView>
  | AsyncIterable<string | NodeJS.ArrayBufferView>;

/** Options for {@link Storage.readFile}. */
export interface StorageReadFileOptions extends Omit<
  GetObjectCommandInput,
  "Bucket" | "Key"
> {
  /** Character encoding for a string result; omit or use `null` for a Buffer. */
  encoding?: BufferEncoding | null;

  /** Optional signal that aborts the S3 request. */
  signal?: AbortSignal;
}

/** Options for {@link Storage.createReadStream}. */
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

/** Options shared by buffered and streaming writes. */
export interface StorageWriteFileOptions extends Omit<
  PutObjectCommandInput,
  "Body" | "Bucket" | "Key"
> {
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
}

/** Options for {@link Storage.createWriteStream}. */
export interface StorageWriteStreamOptions extends StorageWriteFileOptions {
  /** Internal stream buffer size in bytes. */
  highWaterMark?: number;
}
