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

/** Laravel-inspired file storage backed by an S3-compatible object store. */
export class Storage {
  private readonly bucket: string;
  private readonly publicEndpointUrl?: string;
  private readonly rootPath: string;

  /**
   * Creates a Storage service.
   * @param s3Client - S3 client provided by {@link StorageModule}
   * @param options - Storage configuration
   * @param s3UrlClient - Optional client configured with the public endpoint
   */
  constructor(
    private readonly s3Client: S3Client,
    options: StorageModuleOptions,
    private readonly s3UrlClient: S3Client = s3Client,
  ) {
    if (!options.bucket?.trim()) {
      throw new Error(
        "Storage bucket is required; set STORAGE_BUCKET or register StorageModule with a bucket",
      );
    }

    this.bucket = options.bucket;
    this.publicEndpointUrl = options.publicEndpointUrl;
    this.rootPath = normalizePath(options.rootPath ?? "");
  }

  /**
   * Returns the direct URL for an object.
   * @param path - Object path relative to the configured root
   * @returns The path-style or virtual-host-style object URL
   */
  async getUrl(path: string): Promise<string> {
    const key = encodePath(this.objectKey(path));

    if (this.publicEndpointUrl) {
      const url = new URL(this.publicEndpointUrl);
      url.pathname = `${url.pathname.replace(/\/$/, "")}/${key}`;

      return url.toString();
    }

    const config = this.s3UrlClient.config;
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
      this.s3UrlClient,
      new GetObjectCommand({
        ...getObjectOptions,
        Bucket: this.bucket,
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

    return await createPresignedPost(this.s3UrlClient, {
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
    const result = await this.s3Client.send(
      new GetObjectCommand({
        ...getObjectOptions,
        Bucket: this.bucket,
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
      client: this.s3Client,
      params: {
        ...putObjectOptions,
        Bucket: this.bucket,
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
      client: this.s3Client,
      params: {
        ...putObjectOptions,
        Bucket: this.bucket,
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
    const sourceMetadata = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
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

    await this.s3Client.send(
      new CopyObjectCommand({
        ...options,
        Bucket: this.bucket,
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
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(paths),
        }),
      );
      return;
    }

    for (let index = 0; index < paths.length; index += MAX_DELETE_OBJECTS) {
      const chunk = paths.slice(index, index + MAX_DELETE_OBJECTS);
      const result = await this.s3Client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
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
    const result = await this.s3Client.send(
      new GetObjectCommand({
        ...options,
        Bucket: this.bucket,
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
      const page = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
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

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function resolveOptionalBoolean(
  value:
    | boolean
    | (() => boolean | undefined | Promise<boolean | undefined>)
    | undefined,
): Promise<boolean | undefined> {
  return typeof value === "function" ? await value() : value;
}

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

function arrayBufferView(data: NodeJS.ArrayBufferView): Buffer {
  return Buffer.from(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  );
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
