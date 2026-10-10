import { PassThrough, Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  CopyObjectCommand,
  type CopyObjectCommandInput,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  type GetObjectCommandInput,
  HeadObjectCommand,
  ListObjectsV2Command,
  type ListObjectsV2Output,
  type PutObjectCommandInput,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  type StorageEntry,
  type StorageListEntriesOptions,
} from "./interfaces/storage-entry.interface.js";
import {
  type StorageFileData,
  type StorageReadFileOptions,
  type StorageReadStreamOptions,
  type StorageWriteFileOptions,
  type StorageWriteStreamOptions,
} from "./interfaces/storage-file-options.interface.js";
import { type StorageModuleOptions } from "./interfaces/storage-module-options.interface.js";
import {
  type StorageTemporaryUpload,
  type StorageTemporaryUploadUrlOptions,
  type StorageTemporaryUrlOptions,
} from "./interfaces/storage-url-options.interface.js";

const MAX_DELETE_OBJECTS = 1000;
const MAX_SINGLE_COPY_SIZE = 5 * 1024 * 1024 * 1024;

/** File storage backed by an S3-compatible object store. */
export class Storage {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly clientBucket: string;
  private readonly endpointUrl?: string;
  private readonly internalClient: S3Client;
  private readonly internalClientBucket: string;
  private readonly rootPath: string;

  /**
   * Creates a Storage service.
   * @param options - Storage configuration
   */
  constructor(options: StorageModuleOptions) {
    if (!options.bucket?.trim()) {
      throw new Error(
        "Storage bucket is required; set STORAGE_BUCKET or register StorageModule with a bucket",
      );
    }
    if (Boolean(options.accessKeyId) !== Boolean(options.secretAccessKey)) {
      throw new Error(
        "Storage credentials require both accessKeyId and secretAccessKey",
      );
    }
    if (options.bucketEndpoint && !options.endpointUrl) {
      throw new Error("Storage bucketEndpoint requires endpointUrl");
    }

    const bucketEndpoint = options.bucketEndpoint ?? false;
    const endpointUrl = normalizeBucketEndpointUrl(
      options.endpointUrl,
      bucketEndpoint,
    );
    const internalBucketEndpoint =
      options.internalBucketEndpoint ?? bucketEndpoint;
    const internalEndpointUrl = normalizeBucketEndpointUrl(
      options.internalEndpointUrl ?? options.endpointUrl,
      internalBucketEndpoint,
    );

    if (internalBucketEndpoint && !internalEndpointUrl) {
      throw new Error(
        "Storage internalBucketEndpoint requires internalEndpointUrl or endpointUrl",
      );
    }

    this.bucket = options.bucket;
    this.endpointUrl = endpointUrl;
    this.rootPath = normalizePath(options.rootPath ?? "");

    this.client = new S3Client(
      createS3ClientConfig(options, endpointUrl, bucketEndpoint),
    );
    this.clientBucket =
      bucketEndpoint && endpointUrl ? endpointUrl : this.bucket;
    this.internalClientBucket =
      internalBucketEndpoint && internalEndpointUrl
        ? internalEndpointUrl
        : this.bucket;
    this.internalClient =
      internalEndpointUrl === endpointUrl &&
      internalBucketEndpoint === bucketEndpoint
        ? this.client
        : new S3Client(
            createS3ClientConfig(
              options,
              internalEndpointUrl,
              internalBucketEndpoint,
            ),
          );
  }

  /** Releases resources held by the AWS SDK clients. */
  onApplicationShutdown(): void {
    for (const client of new Set([this.client, this.internalClient])) {
      client.destroy();
    }
  }

  /**
   * Returns the direct URL for an object.
   * @param path - Object path relative to the configured root
   * @returns The path-style or virtual-host-style object URL
   */
  async getUrl(path: string): Promise<string> {
    const key = encodePath(this.objectKey(path));

    if (this.client.config.bucketEndpoint && this.endpointUrl) {
      const url = new URL(this.endpointUrl);
      url.pathname = `${url.pathname.replace(/\/$/, "")}/${key}`;

      return url.toString();
    }

    const config = this.client.config;
    const configuredEndpoint = await config.endpoint?.();
    const endpoint = config.endpointProvider(
      {
        Bucket: this.bucket,
        Region: await config.region(),
        UseFIPS: await resolveOptionalBoolean(config.useFipsEndpoint),
        UseDualStack: await resolveOptionalBoolean(config.useDualstackEndpoint),
        ...(configuredEndpoint
          ? {
              Endpoint: `${configuredEndpoint.protocol}//${configuredEndpoint.hostname}${configuredEndpoint.port ? `:${String(configuredEndpoint.port)}` : ""}${configuredEndpoint.path}`,
            }
          : {}),
        ForcePathStyle: await resolveOptionalBoolean(config.forcePathStyle),
        Accelerate: await resolveOptionalBoolean(config.useAccelerateEndpoint),
        UseGlobalEndpoint: await resolveOptionalBoolean(
          config.useGlobalEndpoint,
        ),
        DisableMultiRegionAccessPoints: await resolveOptionalBoolean(
          config.disableMultiregionAccessPoints,
        ),
        UseArnRegion: await resolveOptionalBoolean(config.useArnRegion),
        DisableS3ExpressSessionAuth: await resolveOptionalBoolean(
          config.disableS3ExpressSessionAuth,
        ),
      },
      {},
    );
    const url = new URL(endpoint.url);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${key}`;

    return url.toString();
  }

  /**
   * Creates a temporary signed URL for reading an object.
   * @param path - Object path relative to the configured root
   * @param options - S3 response options and signature lifetime
   * @returns A temporary signed GET URL
   */
  async createTemporaryUrl(
    path: string,
    options: StorageTemporaryUrlOptions = {},
  ): Promise<string> {
    const { expiresIn, ...getObjectOptions } = options;

    return await getSignedUrl(
      this.client,
      new GetObjectCommand({
        ...getObjectOptions,
        Bucket: this.clientBucket,
        Key: this.objectKey(path),
      }),
      expiresIn === undefined ? {} : { expiresIn },
    );
  }

  /**
   * Creates a temporary presigned POST for uploading an object.
   * @param path - Destination path relative to the configured root
   * @param options - Form fields, policy conditions, and signature lifetime
   * @returns The upload URL and required form fields
   */
  async createTemporaryUploadUrl(
    path: string,
    options: StorageTemporaryUploadUrlOptions = {},
  ): Promise<StorageTemporaryUpload> {
    const key = this.objectKey(path);

    const upload = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ["eq", "$bucket", this.bucket],
        ["eq", "$key", key],
        ...(options.conditions ?? []),
      ],
      ...(options.fields ? { Fields: options.fields } : {}),
      ...(options.expiresIn === undefined
        ? {}
        : { Expires: options.expiresIn }),
    });

    return this.client.config.bucketEndpoint && this.endpointUrl
      ? { ...upload, url: ensureTrailingSlash(this.endpointUrl) }
      : upload;
  }

  /**
   * Reads an entire object into memory.
   * @param path - Object path relative to the configured root
   * @param options - S3 read options and optional result encoding
   * @returns Object contents as a Buffer or encoded string
   */
  async readFile(
    path: string,
    options:
      | (StorageReadFileOptions & { encoding: BufferEncoding })
      | BufferEncoding,
  ): Promise<string>;

  /**
   * Reads an entire object into memory.
   * @param path - Object path relative to the configured root
   * @param options - S3 read options without a string encoding
   * @returns Object contents as a Buffer
   */
  async readFile(
    path: string,
    options?: StorageReadFileOptions | null,
  ): Promise<Buffer>;

  async readFile(
    path: string,
    options: StorageReadFileOptions | BufferEncoding | null = {},
  ): Promise<Buffer | string> {
    const resolvedOptions =
      typeof options === "string" ? { encoding: options } : (options ?? {});
    const { encoding, signal, ...getObjectOptions } = resolvedOptions;
    const result = await this.internalClient.send(
      new GetObjectCommand({
        ...getObjectOptions,
        Bucket: this.internalClientBucket,
        Key: this.objectKey(path),
      }),
      { abortSignal: signal },
    );

    if (!result.Body) {
      throw new Error(`S3 returned an empty response body for ${path}`);
    }

    const contents = Buffer.from(await result.Body.transformToByteArray());
    return encoding ? contents.toString(encoding) : contents;
  }

  /**
   * Creates a readable stream for an object.
   * @param path - Object path relative to the configured root
   * @param options - S3, byte-range, stream, and abort options
   * @returns A stream that emits the object contents
   */
  createReadStream(
    path: string,
    options: StorageReadStreamOptions | BufferEncoding = {},
  ): Readable {
    const resolvedOptions =
      typeof options === "string" ? { encoding: options } : options;
    const { encoding, end, highWaterMark, signal, start, ...getObjectOptions } =
      resolvedOptions;
    const range = byteRange(start, end);
    const output = new PassThrough({ highWaterMark });
    const { controller, dispose } = linkedAbortController(signal);

    if (encoding) {
      output.setEncoding(encoding);
    }

    output.once("close", () => {
      controller.abort();
      dispose();
    });

    void this.pipeObject(
      path,
      output,
      {
        ...getObjectOptions,
        ...(range ? { Range: range } : {}),
      },
      controller.signal,
    ).catch((error: unknown) => output.destroy(asError(error)));

    return output;
  }

  /**
   * Replaces an object with the supplied data.
   * @param path - Destination path relative to the configured root
   * @param data - String, buffer view, iterable, or async iterable data
   * @param options - S3, encoding, multipart, and abort options
   */
  async writeFile(
    path: string,
    data: StorageFileData,
    options: StorageWriteFileOptions | BufferEncoding | null = {},
  ): Promise<void> {
    const resolvedOptions =
      typeof options === "string" ? { encoding: options } : (options ?? {});
    const {
      encoding,
      leavePartsOnError,
      partSize,
      queueSize,
      signal,
      ...putObjectOptions
    } = resolvedOptions;
    const { controller, dispose } = linkedAbortController(signal);
    const upload = new Upload({
      client: this.internalClient,
      params: {
        ...putObjectOptions,
        Bucket: this.internalClientBucket,
        Key: this.objectKey(path),
        Body: uploadBody(data, encoding),
      },
      abortController: controller,
      leavePartsOnError,
      partSize,
      queueSize,
    });

    try {
      await upload.done();
    } finally {
      dispose();
    }
  }

  /**
   * Creates a writable stream that replaces an object when it finishes.
   * @param path - Destination path relative to the configured root
   * @param options - S3, encoding, multipart, stream, and abort options
   * @returns A stream whose `finish` event means the S3 upload completed
   */
  createWriteStream(
    path: string,
    options: StorageWriteStreamOptions | BufferEncoding = {},
  ): Writable {
    const resolvedOptions =
      typeof options === "string" ? { encoding: options } : options;
    const {
      encoding,
      highWaterMark,
      leavePartsOnError,
      partSize,
      queueSize,
      signal,
      ...putObjectOptions
    } = resolvedOptions;
    const body = new PassThrough({ highWaterMark });
    const { controller, dispose } = linkedAbortController(signal);
    const upload = new Upload({
      client: this.internalClient,
      params: {
        ...putObjectOptions,
        Bucket: this.internalClientBucket,
        Key: this.objectKey(path),
        Body: body,
      },
      abortController: controller,
      leavePartsOnError,
      partSize,
      queueSize,
    });
    const completion = upload.done().then(() => undefined);
    let completed = false;

    const output = new Writable({
      defaultEncoding: encoding,
      highWaterMark,
      write(chunk, chunkEncoding, callback) {
        if (body.write(chunk, chunkEncoding)) {
          callback();
        } else {
          body.once("drain", callback);
        }
      },
      final(callback) {
        body.end();
        void completion.then(
          () => {
            completed = true;
            callback();
          },
          (error: unknown) => {
            callback(asError(error));
          },
        );
      },
      destroy(error, callback) {
        body.destroy(error ?? undefined);
        callback(error);
      },
    });

    void completion.catch((error: unknown) => {
      if (!output.destroyed) {
        output.destroy(asError(error));
      }
    });
    output.once("close", () => {
      if (!completed) {
        controller.abort();
        void upload.abort().catch(() => undefined);
      }
      dispose();
    });

    return output;
  }

  /**
   * Copies an object to another path on the same storage disk.
   * @param from - Existing object path
   * @param to - Destination object path
   * @param options - Additional S3 CopyObject options
   */
  async copyFile(
    from: string,
    to: string,
    options: Omit<CopyObjectCommandInput, "Bucket" | "CopySource" | "Key"> = {},
  ): Promise<void> {
    const source = this.objectKey(from);
    const destination = this.objectKey(to);
    const sourceMetadata = await this.internalClient.send(
      new HeadObjectCommand({
        Bucket: this.internalClientBucket,
        Key: source,
        ExpectedBucketOwner: options.ExpectedSourceBucketOwner,
        IfMatch: options.CopySourceIfMatch,
        IfModifiedSince: options.CopySourceIfModifiedSince,
        IfNoneMatch: options.CopySourceIfNoneMatch,
        IfUnmodifiedSince: options.CopySourceIfUnmodifiedSince,
        RequestPayer: options.RequestPayer,
        SSECustomerAlgorithm: options.CopySourceSSECustomerAlgorithm,
        SSECustomerKey: options.CopySourceSSECustomerKey,
        SSECustomerKeyMD5: options.CopySourceSSECustomerKeyMD5,
      }),
    );

    if (sourceMetadata.ContentLength === undefined) {
      throw new Error(`S3 did not return a content length for ${from}`);
    }

    const copySource = `${this.bucket}/${encodePath(source)}`;
    if (sourceMetadata.ContentLength > MAX_SINGLE_COPY_SIZE) {
      throw new RangeError(
        `Storage copy source exceeds the 5 GB limit: ${from}`,
      );
    }

    await this.internalClient.send(
      new CopyObjectCommand({
        ...options,
        Bucket: this.internalClientBucket,
        CopySource: copySource,
        Key: destination,
      }),
    );
  }

  /**
   * Moves an object to another path on the same storage disk.
   * @param from - Existing object path
   * @param to - Destination object path
   * @param options - Additional S3 CopyObject options used by the copy step
   */
  async moveFile(
    from: string,
    to: string,
    options: Omit<CopyObjectCommandInput, "Bucket" | "CopySource" | "Key"> = {},
  ): Promise<void> {
    if (this.objectKey(from) === this.objectKey(to)) {
      return;
    }

    await this.copyFile(from, to, options);
    await this.deleteFile(from);
  }

  /**
   * Deletes one or more objects.
   * @param paths - Object path or paths relative to the configured root
   */
  async deleteFile(paths: string | readonly string[]): Promise<void> {
    if (typeof paths === "string") {
      await this.internalClient.send(
        new DeleteObjectCommand({
          Bucket: this.internalClientBucket,
          Key: this.objectKey(paths),
        }),
      );
      return;
    }

    for (let index = 0; index < paths.length; index += MAX_DELETE_OBJECTS) {
      const chunk = paths.slice(index, index + MAX_DELETE_OBJECTS);
      const result = await this.internalClient.send(
        new DeleteObjectsCommand({
          Bucket: this.internalClientBucket,
          Delete: {
            Objects: chunk.map((path) => ({ Key: this.objectKey(path) })),
            Quiet: true,
          },
        }),
      );

      if (result.Errors?.length) {
        const failures = result.Errors.map(
          ({ Key, Code }) => `${Key ?? "unknown"} (${Code ?? "unknown"})`,
        ).join(", ");
        throw new Error(`Failed to delete S3 objects: ${failures}`);
      }
    }
  }

  /**
   * Lists files and directories below a path.
   * @param directory - Directory relative to the configured root
   * @param options - Set `recursive` to include every descendant
   * @returns Entries sorted by path, with paths relative to the storage root
   */
  async listEntries(
    directory = "",
    options: StorageListEntriesOptions = {},
  ): Promise<StorageEntry[]> {
    const base = normalizePath(directory);
    const baseDepth = base ? base.split("/").length : 0;
    const entries = new Map<string, StorageEntry>();

    const addDirectory = (path: string): void => {
      if (path && path !== base) {
        entries.set(`directory:${path}`, { path, type: "directory" });
      }
    };

    for await (const page of this.list(
      directory,
      options.recursive ? undefined : "/",
    )) {
      for (const prefix of page.CommonPrefixes ?? []) {
        if (prefix.Prefix) {
          addDirectory(this.relativePath(prefix.Prefix.replace(/\/$/, "")));
        }
      }

      for (const object of page.Contents ?? []) {
        if (!object.Key) {
          continue;
        }

        const relative = this.relativePath(object.Key);
        const parts = relative.replace(/\/$/, "").split("/");
        const isDirectory = object.Key.endsWith("/");
        const directoryPartCount = isDirectory
          ? parts.length
          : parts.length - 1;

        if (options.recursive) {
          for (
            let index = baseDepth + 1;
            index <= directoryPartCount;
            index += 1
          ) {
            addDirectory(parts.slice(0, index).join("/"));
          }
        }

        if (!isDirectory) {
          entries.set(`file:${relative}`, {
            path: relative,
            type: "file",
            ...(object.Size === undefined ? {} : { size: object.Size }),
            ...(object.LastModified
              ? { lastModified: object.LastModified }
              : {}),
            ...(object.ETag ? { etag: object.ETag } : {}),
          });
        } else if (!options.recursive) {
          addDirectory(parts.join("/"));
        }
      }
    }

    return [...entries.values()].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
  }

  private async pipeObject(
    path: string,
    output: Writable,
    options: Omit<GetObjectCommandInput, "Bucket" | "Key">,
    signal: AbortSignal,
  ): Promise<void> {
    const result = await this.internalClient.send(
      new GetObjectCommand({
        ...options,
        Bucket: this.internalClientBucket,
        Key: this.objectKey(path),
      }),
      { abortSignal: signal },
    );

    if (!(result.Body instanceof Readable)) {
      throw new Error(`S3 returned a non-Node.js stream body for ${path}`);
    }

    await pipeline(result.Body, output);
  }

  private objectKey(path: string): string {
    const relative = normalizePath(path);
    if (!relative) {
      throw new TypeError("Storage path must not be empty");
    }

    return this.rootPath ? `${this.rootPath}/${relative}` : relative;
  }

  private directoryPrefix(directory: string): string {
    const relative = normalizePath(directory);
    const prefix = [this.rootPath, relative].filter(Boolean).join("/");
    return prefix ? `${prefix}/` : "";
  }

  private relativePath(key: string): string {
    if (!this.rootPath) {
      return key;
    }

    const prefix = `${this.rootPath}/`;
    if (!key.startsWith(prefix)) {
      throw new Error(`S3 returned an object outside the storage root: ${key}`);
    }

    return key.slice(prefix.length);
  }

  private async *list(
    directory: string,
    delimiter?: string,
  ): AsyncGenerator<ListObjectsV2Output> {
    let continuationToken: string | undefined;

    do {
      const page = await this.internalClient.send(
        new ListObjectsV2Command({
          Bucket: this.internalClientBucket,
          Prefix: this.directoryPrefix(directory),
          ...(delimiter ? { Delimiter: delimiter } : {}),
          ...(continuationToken
            ? { ContinuationToken: continuationToken }
            : {}),
        }),
      );
      yield page;

      if (page.IsTruncated && !page.NextContinuationToken) {
        throw new Error(
          "S3 listing was truncated without a continuation token",
        );
      }
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }
}

/**
 * Returns s3 client options with credentials, endpoint, and bucket addressing settings.
 * @param options - Configuration for this operation.
 * @param endpointUrl - Configured S3 endpoint URL.
 * @param bucketEndpoint - Whether the endpoint already identifies the bucket.
 * @returns S3 client options with credentials, endpoint, and bucket addressing settings.
 */
function createS3ClientConfig(
  options: StorageModuleOptions,
  endpointUrl: string | undefined,
  bucketEndpoint: boolean,
): S3ClientConfig {
  const { accessKeyId, forcePathStyle, region, secretAccessKey } = options;

  return {
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    ...(endpointUrl ? { endpoint: endpointUrl } : {}),
    ...(bucketEndpoint ? { bucketEndpoint: true } : {}),
    ...(bucketEndpoint || forcePathStyle === undefined
      ? {}
      : { forcePathStyle }),
    ...(region ? { region } : {}),
  };
}

/**
 * Returns endpoint URL ending with a slash.
 * @param endpointUrl - Configured S3 endpoint URL.
 * @returns Endpoint URL ending with a slash.
 */
function ensureTrailingSlash(endpointUrl: string): string {
  const url = new URL(endpointUrl);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/`;
  return url.toString();
}

/**
 * Returns normalized endpoint URL, or undefined when no endpoint is supplied.
 * @param endpointUrl - Configured S3 endpoint URL.
 * @param bucketEndpoint - Whether the endpoint already identifies the bucket.
 * @returns Normalized endpoint URL, or undefined when no endpoint is supplied.
 */
function normalizeBucketEndpointUrl(
  endpointUrl: string | undefined,
  bucketEndpoint: boolean,
): string | undefined {
  if (!endpointUrl || !bucketEndpoint) {
    return endpointUrl;
  }

  const url = new URL(endpointUrl);
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

/**
 * Returns storage path with redundant separators and dot segments normalized.
 * @param path - Path to normalize or access.
 * @returns Storage path with redundant separators and dot segments normalized.
 */
function normalizePath(path: string): string {
  const parts = path.replaceAll("\\", "/").split("/");
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      throw new TypeError("Storage paths must not contain '..' segments");
    }
    normalized.push(part);
  }

  return normalized.join("/");
}

/**
 * Returns path with each component percent-encoded.
 * @param path - Path to normalize or access.
 * @returns Path with each component percent-encoded.
 */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Returns resolved flag, or undefined when no value is configured.
 * @param value - Value to inspect or transform.
 * @returns Resolved flag, or undefined when no value is configured.
 */
async function resolveOptionalBoolean(
  value:
    | boolean
    | (() => boolean | undefined | Promise<boolean | undefined>)
    | undefined,
): Promise<boolean | undefined> {
  return typeof value === "function" ? await value() : value;
}

/**
 * Returns hTTP byte-range value, or undefined when no range is requested.
 * @param start - Inclusive starting byte offset.
 * @param end - Inclusive ending byte offset.
 * @returns HTTP byte-range value, or undefined when no range is requested.
 */
function byteRange(start?: number, end?: number): string | undefined {
  for (const [name, offset] of [
    ["start", start],
    ["end", end],
  ] as const) {
    if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0)) {
      throw new RangeError(
        `Storage stream ${name} must be a non-negative integer`,
      );
    }
  }

  const resolvedStart = start ?? (end === undefined ? undefined : 0);
  if (resolvedStart === undefined) {
    return undefined;
  }
  if (end !== undefined && end < resolvedStart) {
    throw new RangeError("Storage stream end must not be less than start");
  }

  return `bytes=${String(resolvedStart)}-${end === undefined ? "" : String(end)}`;
}

/**
 * Returns abort controller linked to the signal and a listener cleanup callback.
 * @param signal - Abort signal to propagate to the operation.
 * @returns Abort controller linked to the signal and a listener cleanup callback.
 */
function linkedAbortController(signal?: AbortSignal): {
  controller: AbortController;
  dispose: () => void;
} {
  const controller = new AbortController();
  const abort = () => {
    controller.abort(signal?.reason);
  };

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }

  return {
    controller,
    dispose: () => signal?.removeEventListener("abort", abort),
  };
}

/**
 * Returns body representation suitable for an S3 upload.
 * @param data - Data used to construct the result.
 * @param encoding - Encoding used to convert text chunks to bytes.
 * @returns Body representation suitable for an S3 upload.
 */
function uploadBody(
  data: StorageFileData,
  encoding?: BufferEncoding,
): PutObjectCommandInput["Body"] {
  if (typeof data === "string") {
    return Buffer.from(data, encoding);
  }
  if (ArrayBuffer.isView(data)) {
    return arrayBufferView(data);
  }

  return Readable.from(uploadChunks(data, encoding));
}

/**
 * Converts iterable upload data into byte chunks.
 * @yields {Buffer} Each upload chunk encoded as bytes.
 * @param data - Data used to construct the result.
 * @param encoding - Encoding used to convert text chunks to bytes.
 */
async function* uploadChunks(
  data:
    | Iterable<string | NodeJS.ArrayBufferView>
    | AsyncIterable<string | NodeJS.ArrayBufferView>,
  encoding?: BufferEncoding,
): AsyncGenerator<Buffer> {
  for await (const chunk of data) {
    yield typeof chunk === "string"
      ? Buffer.from(chunk, encoding)
      : arrayBufferView(chunk);
  }
}

/**
 * Returns buffer covering only the input view's byte range.
 * @param data - Data used to construct the result.
 * @returns Buffer covering only the input view's byte range.
 */
function arrayBufferView(data: NodeJS.ArrayBufferView): Buffer {
  return Buffer.from(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  );
}

/**
 * Returns original Error instance or an Error wrapping the failure value.
 * @param error - Failure value to inspect.
 * @returns Original Error instance or an Error wrapping the failure value.
 */
function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
