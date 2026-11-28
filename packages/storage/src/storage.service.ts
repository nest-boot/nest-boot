import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { extname } from "node:path";
import { PassThrough, Readable, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  type GetObjectCommandInput,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  createPresignedPost,
  type PresignedPostOptions,
} from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  RequestMethod,
  UnauthorizedException,
} from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";
import mimeTypes from "mime-types";
import picomatch from "picomatch";

import type {
  StorageCreateFileDownloadUrlOptions,
  StorageDownloadOptions,
} from "./interfaces/storage-download-options.interface.js";
import type {
  StorageFileData,
  StorageFileStat,
  StorageReadFileOptions,
  StorageReadStreamOptions,
} from "./interfaces/storage-file-options.interface.js";
import type { StorageModuleOptions } from "./interfaces/storage-module-options.interface.js";
import type {
  StorageTemporaryFileUploadRequest,
  StorageTemporaryFileUploadUrl,
  StorageUploadFileFromUrlOptions,
  StorageUploadFileOptions,
  StorageUploadLimit,
} from "./interfaces/storage-upload-options.interface.js";
import { RESOLVE_FILE_DOWNLOAD_URL } from "./storage.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./storage.module-definition.js";
import { DEFAULT_STORAGE_UPLOAD_LIMITS } from "./storage-upload-limits.constants.js";
import {
  type CompiledSsrfPolicy,
  compileSsrfPolicy,
  fetchExternalFile,
} from "./utils/fetch-external-file.util.js";
import { loadStorageOptionsFromEnv } from "./utils/load-storage-options-from-env.util.js";
import { normalizeStoragePath } from "./utils/normalize-storage-path.util.js";
import {
  OPTIONAL_JWT_SERVICE_TOKEN,
  type StorageJwtService,
} from "./utils/optional-jwt.util.js";
import {
  DEFAULT_STORAGE_DOWNLOAD_PATH,
  resolveStorageRoutePath,
} from "./utils/resolve-storage-route-path.util.js";
import {
  createS3ClientConfig,
  encodeStoragePath,
  ensureTrailingSlash,
  isS3NotFoundError,
  normalizeBucketEndpointUrl,
  resolveS3PrefixBaseUrl,
} from "./utils/s3-client.util.js";
import {
  asError,
  byteRange,
  ensureNonEmptyStream,
  linkedAbortController,
  uploadBody,
} from "./utils/storage-stream.util.js";

const DOWNLOAD_JWT_SCOPE = {
  type: "storage-download+jwt",
  audience: "storage-download",
} as const;
const DEFAULT_EXPIRES_IN = 60 * 60;
const DEFAULT_EXTERNAL_MAX_FILE_SIZE = 100 * 1024 * 1024;
const DEFAULT_UPLOAD_TIMEOUT_MS = 30_000;
const MAX_DELETE_OBJECTS = 1000;
const MAX_PRESIGNED_LIFETIME = 7 * 24 * 60 * 60;
const MAX_SINGLE_COPY_SIZE = 5 * 1024 * 1024 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const PERMANENT_DIRECTORY = "files";
const TEMPORARY_DIRECTORY = "tmp";
const STORAGE_TOKEN_META_KEY = "storage-upload-token";
const STORAGE_TOKEN_META_HEADER = `x-amz-meta-${STORAGE_TOKEN_META_KEY}`;
const UUID_V4_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\.[^/\\]+)?$/i;
const isSafeInlinePreviewMimeType = picomatch(
  [
    "image/apng",
    "image/avif",
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/vnd.microsoft.icon",
    "image/webp",
    "application/pdf",
    "audio/*",
    "video/*",
  ],
  { nocase: true },
);

interface CompiledUploadLimit {
  fileSize: number;
  matchesMimeType: (mimeType: string) => boolean;
}

interface InternalPresignGetOptions extends Omit<
  GetObjectCommandInput,
  "Bucket" | "Key"
> {
  expiresIn: number;
  signingDate?: Date;
}

interface InternalPresignPostOptions {
  conditions: NonNullable<PresignedPostOptions["Conditions"]>;
  expiresIn: number;
  fields: Record<string, string>;
}

interface MatchedTemporarySource {
  key: string;
  queryDigest: string;
}

/**
 * Unified S3-compatible object storage service enforcing a fixed `tmp/` and
 * `files/YYYY/MM/DD/` layout, zero-bandwidth temporary URL promotion, SSRF-safe
 * external URL uploading, and JWT-signed downloads.
 */
@Injectable()
export class StorageService {
  readonly bucket: string;
  readonly rootPath: string;

  private readonly client: S3Client;
  private readonly clientBucket: string;
  private readonly downloadBasePath: string;
  private readonly downloadExpiresIn: number;
  private readonly downloadOptions: StorageDownloadOptions;
  private readonly downloadOrigin: string;
  private readonly downloadPath: string;
  private readonly endpointUrl?: string;
  private readonly internalClient: S3Client;
  private readonly internalClientBucket: string;
  private readonly ssrfPolicy: CompiledSsrfPolicy;
  private tmpBaseUrlsPromise?: Promise<{ clientBase: URL; internalBase?: URL }>;
  private readonly uploadExpiresIn: number;
  private readonly uploadLimits: CompiledUploadLimit[];
  private readonly uploadTimeout: number;

  /**
   * Creates a StorageService instance.
   * @param options - Storage, upload, and download configuration options.
   * @param applicationConfig - Optional Nest application configuration for global route prefixes.
   * @param jwt - Optional JWT service used to sign and verify file download tokens.
   */
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    options?: StorageModuleOptions,
    @Optional()
    private readonly applicationConfig?: ApplicationConfig,
    @Optional()
    @Inject(OPTIONAL_JWT_SERVICE_TOKEN)
    private readonly jwt?: StorageJwtService,
  ) {
    const resolved = loadStorageOptionsFromEnv(options);
    if (!resolved.bucket?.trim()) {
      throw new Error(
        "Storage bucket is required; set STORAGE_BUCKET or register StorageModule with a bucket",
      );
    }
    if (Boolean(resolved.accessKeyId) !== Boolean(resolved.secretAccessKey)) {
      throw new Error(
        "Storage credentials require both accessKeyId and secretAccessKey",
      );
    }
    if (resolved.bucketEndpoint && !resolved.endpointUrl) {
      throw new Error("Storage bucketEndpoint requires endpointUrl");
    }

    const bucketEndpoint = resolved.bucketEndpoint ?? false;
    const endpointUrl = normalizeBucketEndpointUrl(
      resolved.endpointUrl,
      bucketEndpoint,
    );
    const internalBucketEndpoint =
      resolved.internalBucketEndpoint ?? bucketEndpoint;
    const internalEndpointUrl = normalizeBucketEndpointUrl(
      resolved.internalEndpointUrl ?? resolved.endpointUrl,
      internalBucketEndpoint,
    );

    if (internalBucketEndpoint && !internalEndpointUrl) {
      throw new Error(
        "Storage internalBucketEndpoint requires internalEndpointUrl or endpointUrl",
      );
    }

    this.bucket = resolved.bucket.trim();
    this.endpointUrl = endpointUrl;
    this.rootPath = normalizeStoragePath(resolved.rootPath ?? "");

    this.client = new S3Client(
      createS3ClientConfig(resolved, endpointUrl, bucketEndpoint),
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
              resolved,
              internalEndpointUrl,
              internalBucketEndpoint,
            ),
          );

    const upload = resolved.upload;
    this.uploadExpiresIn = upload?.expiresIn ?? DEFAULT_EXPIRES_IN;
    if (!isValidLifetimeSeconds(this.uploadExpiresIn)) {
      throw new Error(
        "Storage upload expiry must be between 1 and 604800 seconds",
      );
    }
    this.uploadTimeout = upload?.timeout ?? DEFAULT_UPLOAD_TIMEOUT_MS;
    if (!Number.isSafeInteger(this.uploadTimeout) || this.uploadTimeout < 1) {
      throw new Error("Storage upload timeout must be a positive integer");
    }
    const configuredLimits = upload?.limits ?? DEFAULT_STORAGE_UPLOAD_LIMITS;
    if (!Array.isArray(configuredLimits)) {
      throw new Error("Storage upload limits must be an array");
    }
    this.uploadLimits = (configuredLimits as readonly StorageUploadLimit[]).map(
      (limit) => {
        if (!Number.isSafeInteger(limit.fileSize) || limit.fileSize < 1) {
          throw new Error(
            "Storage upload limit fileSize must be a positive integer",
          );
        }
        const rawPatterns: readonly unknown[] = Array.isArray(limit.mimeTypes)
          ? limit.mimeTypes
          : [""];
        if (
          rawPatterns.some(
            (pattern) => typeof pattern !== "string" || !pattern.trim(),
          )
        ) {
          throw new Error(
            "Storage upload limit mimeTypes must contain non-empty patterns",
          );
        }
        const patterns = (rawPatterns as readonly string[]).map((pattern) =>
          pattern.trim(),
        );
        if (patterns.some((pattern) => pattern.startsWith("!"))) {
          throw new Error(
            "Storage upload limit mimeTypes must not use negation",
          );
        }
        return {
          fileSize: limit.fileSize,
          matchesMimeType:
            patterns.length > 0
              ? picomatch(patterns, { nocase: true, nonegate: true })
              : () => false,
        };
      },
    );
    this.ssrfPolicy = compileSsrfPolicy(resolved.ssrf);

    const download = resolved.download;
    this.downloadOptions =
      download?.enabled === false ? { enabled: false } : (download ?? {});
    this.downloadPath = resolveStorageRoutePath(
      this.downloadOptions.path,
      DEFAULT_STORAGE_DOWNLOAD_PATH,
      "download",
    );
    const base = this.downloadOptions.baseURL
      ? new URL(this.downloadOptions.baseURL)
      : undefined;
    if (base && base.protocol !== "http:" && base.protocol !== "https:") {
      throw new Error("Storage download baseURL must use HTTP or HTTPS");
    }
    if (base && (base.search || base.hash)) {
      throw new Error(
        "Storage download baseURL must not include query or hash",
      );
    }
    this.downloadOrigin = base?.origin ?? "";
    this.downloadBasePath = base ? base.pathname.replace(/\/+$/, "") : "";
    this.downloadExpiresIn =
      this.downloadOptions.expiresIn ?? DEFAULT_EXPIRES_IN;
    if (!isValidLifetimeSeconds(this.downloadExpiresIn)) {
      throw new Error(
        "Storage download expiry must be between 1 and 604800 seconds",
      );
    }
  }

  /** Releases resources held by the AWS SDK clients. */
  onApplicationShutdown(): void {
    for (const client of new Set([this.client, this.internalClient])) {
      client.destroy();
    }
  }

  /**
   * Reads an entire file into memory as an encoded string.
   * @param key - File path relative to the configured storage root.
   * @param options - S3 read options and result string encoding.
   * @returns File contents decoded with the requested character encoding.
   */
  async readFile(
    key: string,
    options:
      | (StorageReadFileOptions & { encoding: BufferEncoding })
      | BufferEncoding,
  ): Promise<string>;

  /**
   * Reads an entire file into memory as a Buffer.
   * @param key - File path relative to the configured storage root.
   * @param options - S3 read options without a string encoding.
   * @returns File contents as a Buffer.
   */
  async readFile(
    key: string,
    options?: (StorageReadFileOptions & { encoding?: undefined }) | null,
  ): Promise<Buffer>;

  /**
   * Reads an entire file into memory as a Buffer or string depending on `options.encoding`.
   * @param key - File path relative to the configured storage root.
   * @param options - S3 read options with an optional character encoding.
   * @returns File contents as a Buffer or decoded string.
   */
  async readFile(
    key: string,
    options?: StorageReadFileOptions | BufferEncoding | null,
  ): Promise<Buffer | string>;

  async readFile(
    key: string,
    options: StorageReadFileOptions | BufferEncoding | null = {},
  ): Promise<Buffer | string> {
    const resolvedOptions =
      typeof options === "string" ? { encoding: options } : (options ?? {});
    const { encoding, signal, ...getObjectOptions } = resolvedOptions;
    const result = await this.internalClient.send(
      new GetObjectCommand({
        ...getObjectOptions,
        Bucket: this.internalClientBucket,
        Key: this.objectKey(key),
      }),
      { abortSignal: signal },
    );

    if (!result.Body) {
      throw new Error(`S3 returned an empty response body for ${key}`);
    }

    const contents = Buffer.from(await result.Body.transformToByteArray());
    return encoding ? contents.toString(encoding) : contents;
  }

  /**
   * Creates a readable stream for a file.
   * @param key - File path relative to the configured storage root.
   * @param options - S3, byte-range, stream, and abort options.
   * @returns A stream that emits the file contents.
   */
  createReadStream(
    key: string,
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
      key,
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
   * Retrieves file metadata without downloading its body, or `null` when missing.
   * @param key - File path relative to the configured storage root.
   * @returns File metadata, or `null` when the object does not exist.
   */
  async statFile(key: string): Promise<StorageFileStat | null> {
    const objectKey = this.objectKey(key);

    try {
      const result = await this.internalClient.send(
        new HeadObjectCommand({
          Bucket: this.internalClientBucket,
          Key: objectKey,
        }),
      );

      return {
        size: result.ContentLength ?? 0,
        ...(result.ContentType ? { contentType: result.ContentType } : {}),
        ...(result.LastModified ? { lastModified: result.LastModified } : {}),
        ...(result.ETag ? { etag: result.ETag } : {}),
        ...(result.Metadata && Object.keys(result.Metadata).length > 0
          ? { metadata: result.Metadata }
          : {}),
      };
    } catch (error: unknown) {
      if (isS3NotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Deletes one or more files.
   * @param keys - File path or paths relative to the configured storage root.
   */
  async deleteFile(keys: string | readonly string[]): Promise<void> {
    if (typeof keys === "string") {
      await this.internalClient.send(
        new DeleteObjectCommand({
          Bucket: this.internalClientBucket,
          Key: this.objectKey(keys),
        }),
      );
      return;
    }

    for (let index = 0; index < keys.length; index += MAX_DELETE_OBJECTS) {
      const chunk = keys.slice(index, index + MAX_DELETE_OBJECTS);
      const result = await this.internalClient.send(
        new DeleteObjectsCommand({
          Bucket: this.internalClientBucket,
          Delete: {
            Objects: chunk.map((key) => ({ Key: this.objectKey(key) })),
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
   * Creates a presigned POST upload target in `tmp/` together with its temporary readable `resourceUrl`.
   * @param file - Requested file name, byte size, and MIME type.
   * @returns Presigned POST URL, temporary `resourceUrl`, and ordered form fields.
   */
  async createTemporaryFileUploadUrl(
    file: StorageTemporaryFileUploadRequest,
  ): Promise<StorageTemporaryFileUploadUrl> {
    if (
      typeof file !== "object" ||
      file === null ||
      typeof file.name !== "string" ||
      !file.name.trim() ||
      typeof file.mimeType !== "string" ||
      !file.mimeType.trim() ||
      typeof file.fileSize !== "number" ||
      !Number.isSafeInteger(file.fileSize) ||
      file.fileSize < 1
    ) {
      throw new BadRequestException("Invalid temporary file upload request");
    }

    const extension = extname(file.name);
    if (extension.includes("/") || extension.includes("\\")) {
      throw new BadRequestException("Invalid temporary file upload request");
    }

    const normalizedMimeType = normalizeMimeType(file.mimeType);
    const limit = this.matchUploadLimit(normalizedMimeType);
    if (!limit || file.fileSize > limit.fileSize) {
      throw new BadRequestException(
        "The uploaded file does not meet the requirements",
      );
    }

    const key = `${TEMPORARY_DIRECTORY}/${randomUUID()}${extension}`;
    const inlinePreview = isSafeInlinePreviewMimeType(normalizedMimeType);
    const contentDisposition = inlinePreview ? "inline" : "attachment";
    const resourceUrl = await this.presignGetObject(key, {
      expiresIn: this.uploadExpiresIn,
      ResponseCacheControl: "no-store",
      ResponseContentDisposition: contentDisposition,
      ResponseContentType: normalizedMimeType,
    });
    const promotionToken = hashTemporaryResourceQuery(
      new URL(resourceUrl).search,
    );
    const conditions: InternalPresignPostOptions["conditions"] = [
      ["content-length-range", 1, limit.fileSize],
      ["eq", "$Cache-Control", "no-store"],
      ["eq", "$Content-Disposition", contentDisposition],
      ["eq", "$Content-Type", normalizedMimeType],
      ["eq", "$success_action_status", "201"],
      ["eq", `$${STORAGE_TOKEN_META_HEADER}`, promotionToken],
    ];
    const presigned = await this.createPresignedPostUpload(key, {
      conditions,
      expiresIn: this.uploadExpiresIn,
      fields: {
        "Cache-Control": "no-store",
        "Content-Disposition": contentDisposition,
        "Content-Type": normalizedMimeType,
        success_action_status: "201",
        [STORAGE_TOKEN_META_HEADER]: promotionToken,
      },
    });

    return {
      url: presigned.url,
      resourceUrl,
      fields: [
        { name: "key", value: presigned.fields.key },
        ...Object.entries(presigned.fields)
          .filter(([name]) => name !== "key")
          .map(([name, value]) => ({ name, value })),
      ],
    };
  }

  /**
   * Uploads a file from a URL into `files/YYYY/MM/DD/`, using zero-bandwidth S3 `CopyObject`
   * when `url` is a valid temporary `resourceUrl` from this bucket and SSRF-safe streaming fetch
   * for external HTTP/HTTPS URLs.
   * @param url - Presigned temporary `resourceUrl` returned by {@link createTemporaryFileUploadUrl}, or an external HTTP/HTTPS URL.
   * @param options - Optional MIME filter, byte size limit, extension override, timeout, and abort signal.
   * @returns Canonical storage-relative key of the uploaded file under `files/YYYY/MM/DD/`.
   */
  async uploadFileFromUrl(
    url: string,
    options: StorageUploadFileFromUrlOptions = {},
  ): Promise<string> {
    if (typeof url !== "string" || !url.trim()) {
      throw new BadRequestException("Invalid file source URL");
    }
    this.resolveUploadTimeout(options.timeout);
    const explicitExtension =
      options.extension === undefined
        ? undefined
        : normalizeExplicitExtension(options.extension);
    if (
      options.maxFileSize !== undefined &&
      (!Number.isSafeInteger(options.maxFileSize) || options.maxFileSize < 1)
    ) {
      throw new BadRequestException(
        "Storage upload maxFileSize must be a positive integer",
      );
    }

    return await this.withUploadTimeout(
      options.signal,
      options.timeout,
      async (abortSignal, timeoutMs) => {
        const deadline = Date.now() + timeoutMs;
        const temporaryMatch = await this.matchOwnTemporaryUrl(
          url,
          abortSignal,
        );
        if (temporaryMatch !== undefined) {
          return await this.copyObject(
            temporaryMatch,
            options,
            explicitExtension,
            abortSignal,
          );
        }

        const remainingTimeoutMs = Math.max(1, deadline - Date.now());
        let resolvedContentType: string | undefined;
        const fetched = await fetchExternalFile(url, {
          ...(options.maxFileSize === undefined
            ? {}
            : { maxFileSize: options.maxFileSize }),
          resolveMaxFileSize: ({ contentType, pathname }) => {
            const effectiveType = resolveExternalContentType(
              contentType,
              pathname,
            );
            resolvedContentType = effectiveType;
            return this.resolveUploadSourceLimits(
              effectiveType,
              options,
              "The remote file does not meet the requirements",
            );
          },
          signal: abortSignal,
          ssrf: this.ssrfPolicy,
          timeout: remainingTimeoutMs,
        });

        try {
          const contentType =
            resolvedContentType ??
            resolveExternalContentType(fetched.contentType, fetched.pathname);
          if (resolvedContentType === undefined) {
            this.resolveUploadSourceLimits(
              contentType,
              options,
              "The remote file does not meet the requirements",
            );
          }

          const extension = resolveExternalExtension(
            contentType,
            fetched.pathname,
            options.extension,
          );
          const nonEmptyStream = await ensureNonEmptyStream(fetched.stream);
          const key = `${PERMANENT_DIRECTORY}/${formatUtcDate(new Date())}/${randomUUID()}.${extension}`;
          await this.putObjectStream(
            key,
            nonEmptyStream,
            contentType,
            {},
            abortSignal,
          );
          return key;
        } catch (error) {
          if (!fetched.stream.destroyed) {
            fetched.stream.destroy();
          }
          throw error;
        }
      },
    );
  }

  /**
   * Uploads server-side data directly into `tmp/<uuid>.<ext>`.
   * @param data - File content as a string, buffer view, iterable, or stream.
   * @param options - Content type, optional extension, and S3 write options.
   * @returns Canonical storage-relative temporary key (for example `"tmp/<uuid>.png"`).
   */
  async uploadTemporaryFile(
    data: StorageFileData,
    options: StorageUploadFileOptions,
  ): Promise<string> {
    const { contentType, extension, ...writeOptions } = options;
    const resolvedExtension = resolveUploadExtension(contentType, extension);
    const key = `${TEMPORARY_DIRECTORY}/${randomUUID()}.${resolvedExtension}`;

    await this.writeObject(key, data, contentType, writeOptions);
    return key;
  }

  /**
   * Uploads server-side data directly into `files/YYYY/MM/DD/<uuid>.<ext>`.
   * @param data - File content as a string, buffer view, iterable, or stream.
   * @param options - Content type, optional extension, and S3 write options.
   * @returns Canonical storage-relative permanent key (for example `"files/2026/11/27/<uuid>.png"`).
   */
  async uploadFile(
    data: StorageFileData,
    options: StorageUploadFileOptions,
  ): Promise<string> {
    const { contentType, extension, ...writeOptions } = options;
    const resolvedExtension = resolveUploadExtension(contentType, extension);
    const key = `${PERMANENT_DIRECTORY}/${formatUtcDate(new Date())}/${randomUUID()}.${resolvedExtension}`;

    await this.writeObject(key, data, contentType, writeOptions);
    return key;
  }

  /**
   * Creates an application JWT download link for a file the caller has already authorized.
   * @param key - Canonical object path relative to the storage root.
   * @param options - Authorized subject identity and optional per-link expiry override.
   * @returns Application download URL pointing to the signed download controller.
   */
  async createFileDownloadUrl(
    key: string,
    options: StorageCreateFileDownloadUrlOptions,
  ): Promise<string> {
    if (this.downloadOptions.enabled === false) {
      throw new Error("Storage downloads are disabled");
    }
    if (!this.jwt) {
      throw new Error("Storage download links require JwtModule");
    }
    if (typeof options.subject !== "string" || !options.subject.trim()) {
      throw new BadRequestException("Storage download subject is required");
    }

    const expiresIn = options.expiresIn ?? this.downloadExpiresIn;
    if (!isValidLifetimeSeconds(expiresIn)) {
      throw new BadRequestException(
        "Storage download expiry must be between 1 and 604800 seconds",
      );
    }
    if (
      !this.isObjectKey(key) ||
      this.downloadOptions.resolveContentType?.(key) === null
    ) {
      throw new BadRequestException("Invalid storage download key");
    }

    const token = await this.jwt.sign(
      {
        bucket: this.bucket,
        ...(this.rootPath ? { rootPath: this.rootPath } : {}),
        key,
      },
      {
        ...DOWNLOAD_JWT_SCOPE,
        subject: options.subject,
        expiresIn,
      },
    );
    const query = new URLSearchParams({ token });
    return `${this.downloadOrigin}${this.downloadRoutePrefix()}${encodeStoragePath(key)}?${query.toString()}`;
  }

  /**
   * Extracts the canonical storage-relative key from an application file download URL.
   * @param url - An absolute HTTP(S) or root-relative download link.
   * @returns Decoded storage key when the link matches the download route, otherwise `undefined`.
   */
  parseFileDownloadUrl(url: string): string | undefined {
    if (this.downloadOptions.enabled === false) {
      return undefined;
    }
    const pathname = this.extractDownloadPathname(url);
    if (!pathname) {
      return undefined;
    }
    const publicRoute = this.downloadRoutePrefix();
    const appRoute = this.appDownloadRoutePrefix();
    const matchedRoute = pathname.startsWith(publicRoute)
      ? publicRoute
      : url.startsWith("/") &&
          !url.startsWith("//") &&
          pathname.startsWith(appRoute)
        ? appRoute
        : undefined;
    if (!matchedRoute) {
      return undefined;
    }

    try {
      const key = decodeURIComponent(pathname.slice(matchedRoute.length));
      return this.isObjectKey(key) ? key : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Exchanges a verified download token for an S3 presigned URL with the matching deadline.
   * @param key - Object path requested by the client.
   * @param token - Download token from the query string.
   * @returns S3 presigned GET URL with the remaining token lifetime.
   * @internal
   */
  async [RESOLVE_FILE_DOWNLOAD_URL](
    key: string,
    token: unknown,
  ): Promise<string> {
    if (this.downloadOptions.enabled === false || !this.jwt) {
      throw new NotFoundException();
    }
    if (typeof token !== "string" || !this.isObjectKey(key)) {
      throw new UnauthorizedException("Invalid file download");
    }

    const payload = await this.jwt.verify(token, DOWNLOAD_JWT_SCOPE);
    if (
      payload.bucket !== this.bucket ||
      (payload.rootPath ?? "") !== this.rootPath ||
      payload.key !== key ||
      payload.exp === undefined
    ) {
      throw new UnauthorizedException("Invalid file download");
    }

    const contentType = this.downloadOptions.resolveContentType?.(key);
    const signingDate = new Date();
    const expiresIn =
      Math.floor(payload.exp) - Math.floor(signingDate.getTime() / 1000);
    if (contentType === null || !isValidLifetimeSeconds(expiresIn)) {
      throw new UnauthorizedException("Invalid file download");
    }

    const inlineSafe =
      contentType !== undefined &&
      isSafeInlinePreviewMimeType(normalizeMimeType(contentType));

    return await this.presignGetObject(key, {
      expiresIn,
      signingDate,
      ResponseCacheControl: "no-store",
      ...(inlineSafe ? {} : { ResponseContentDisposition: "attachment" }),
      ResponseContentType: contentType,
    });
  }

  private async writeObject(
    key: string,
    data: StorageFileData,
    contentType: string,
    options: Omit<StorageUploadFileOptions, "contentType" | "extension">,
  ): Promise<void> {
    const { signal, timeout, ...restOptions } = options;
    await this.withUploadTimeout(signal, timeout, async (abortSignal) => {
      await this.putObjectStream(
        key,
        data,
        contentType,
        restOptions,
        abortSignal,
      );
    });
  }

  private async putObjectStream(
    key: string,
    data: StorageFileData,
    contentType: string,
    options: Omit<
      StorageUploadFileOptions,
      "contentType" | "extension" | "signal" | "timeout"
    >,
    signal?: AbortSignal,
  ): Promise<void> {
    const {
      encoding,
      leavePartsOnError,
      partSize,
      queueSize,
      ...putObjectOptions
    } = options;
    const objectKey = this.objectKey(key);
    const body = uploadBody(data, encoding);
    if (body instanceof Readable && body.errored) {
      throw asError(body.errored);
    }
    const { controller, dispose } = linkedAbortController(signal);
    const destroySourceOnAbort = () => {
      const abortError = asError(
        controller.signal.reason ?? new Error("Upload aborted."),
      );
      if (body instanceof Readable) {
        destroyReadableSafely(body, abortError);
      }
      if (data instanceof Readable && data !== body) {
        destroyReadableSafely(data, abortError);
      }
    };
    if (controller.signal.aborted) {
      destroySourceOnAbort();
      dispose();
      throw asError(controller.signal.reason ?? new Error("Upload aborted."));
    }
    controller.signal.addEventListener("abort", destroySourceOnAbort, {
      once: true,
    });

    let multipartAborted = false;
    const cancellableClient = {
      config: this.internalClient.config,
      send: async (
        command: unknown,
        requestOptions?: { abortSignal?: AbortSignal },
      ) => {
        if (command instanceof AbortMultipartUploadCommand) {
          multipartAborted = true;
          return await this.internalClient.send(command, requestOptions);
        }
        if (command instanceof CreateMultipartUploadCommand) {
          const { controller: initController, dispose: disposeInit } =
            linkedAbortController(undefined, 10_000);
          const createPromise = this.internalClient.send(command, {
            ...requestOptions,
            abortSignal: initController.signal,
          });
          createPromise.then(
            (res) => {
              disposeInit();
              if (
                controller.signal.aborted &&
                !leavePartsOnError &&
                !multipartAborted &&
                res.UploadId
              ) {
                multipartAborted = true;
                void this.internalClient
                  .send(
                    new AbortMultipartUploadCommand({
                      Bucket: this.internalClientBucket,
                      Key: objectKey,
                      UploadId: res.UploadId,
                    }),
                  )
                  .catch(() => undefined);
              }
            },
            () => {
              disposeInit();
            },
          );
          return await createPromise;
        }
        return await this.internalClient.send(
          command as Parameters<S3Client["send"]>[0],
          {
            ...requestOptions,
            abortSignal: controller.signal,
          },
        );
      },
    } as S3Client;

    const safeDisposition = resolveSafeContentDisposition(
      contentType,
      putObjectOptions.ContentDisposition,
    );
    const upload = new Upload({
      client: cancellableClient,
      params: {
        ...putObjectOptions,
        Bucket: this.internalClientBucket,
        CacheControl: putObjectOptions.CacheControl ?? "no-store",
        ...(safeDisposition ? { ContentDisposition: safeDisposition } : {}),
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      },
      abortController: controller,
      leavePartsOnError,
      partSize,
      queueSize,
    });

    try {
      await upload.done();
    } finally {
      controller.signal.removeEventListener("abort", destroySourceOnAbort);
      dispose();
    }
  }

  private resolveUploadTimeout(override?: number): number {
    if (override === undefined) {
      return this.uploadTimeout;
    }
    if (!Number.isSafeInteger(override) || override < 1) {
      throw new BadRequestException(
        "Storage upload timeout must be a positive integer",
      );
    }
    return override;
  }

  private async withUploadTimeout<T>(
    signal: AbortSignal | undefined,
    timeoutOverride: number | undefined,
    operation: (abortSignal: AbortSignal, timeoutMs: number) => Promise<T>,
  ): Promise<T> {
    const timeoutMs = this.resolveUploadTimeout(timeoutOverride);
    const timeoutError = new Error(
      `Storage upload timed out after ${String(timeoutMs)}ms`,
    );
    const { controller, dispose } = linkedAbortController(
      signal,
      timeoutMs,
      timeoutError,
    );

    try {
      return await raceWithAbortSignal(
        operation(controller.signal, timeoutMs),
        controller.signal,
      );
    } catch (error) {
      if (
        controller.signal.reason === timeoutError &&
        !(error instanceof BadRequestException)
      ) {
        throw timeoutError;
      }
      throw error;
    } finally {
      dispose();
    }
  }

  private matchUploadLimit(mimeType: string): CompiledUploadLimit | undefined {
    return this.uploadLimits.find((candidate) =>
      candidate.matchesMimeType(mimeType),
    );
  }

  private resolveUploadSourceLimits(
    contentType: string,
    constraints: Pick<
      StorageUploadFileFromUrlOptions,
      "allowedMimeTypes" | "maxFileSize"
    >,
    errorMessage: string,
  ): number {
    const normalizedType = normalizeMimeType(contentType);
    const matchedRule = this.matchUploadLimit(normalizedType);

    if (constraints.allowedMimeTypes !== undefined) {
      const patterns = constraints.allowedMimeTypes
        .map((pattern) => pattern.trim())
        .filter(Boolean);
      if (patterns.some((pattern) => pattern.startsWith("!"))) {
        throw new BadRequestException(
          "Storage upload allowedMimeTypes must not use negation",
        );
      }
      const matchesOverride =
        patterns.length > 0 &&
        picomatch(patterns, { nocase: true, nonegate: true })(normalizedType);
      if (!matchesOverride) {
        throw new BadRequestException(errorMessage);
      }
      return (
        constraints.maxFileSize ??
        matchedRule?.fileSize ??
        DEFAULT_EXTERNAL_MAX_FILE_SIZE
      );
    }

    if (!matchedRule) {
      throw new BadRequestException(errorMessage);
    }

    return constraints.maxFileSize ?? matchedRule.fileSize;
  }

  private async copyObject(
    sourceMatch: MatchedTemporarySource,
    constraints: Pick<
      StorageUploadFileFromUrlOptions,
      "allowedMimeTypes" | "maxFileSize"
    > = {},
    explicitExtension?: string,
    abortSignal?: AbortSignal,
  ): Promise<string> {
    const fromKey = sourceMatch.key;
    const source = this.objectKey(fromKey);
    let sourceMetadata;
    try {
      sourceMetadata = await this.internalClient.send(
        new HeadObjectCommand({
          Bucket: this.internalClientBucket,
          Key: source,
        }),
        { abortSignal },
      );
    } catch (error: unknown) {
      if (isS3NotFoundError(error)) {
        throw new BadRequestException("Temporary file not found");
      }
      throw error;
    }

    const storedToken = sourceMetadata.Metadata?.[STORAGE_TOKEN_META_KEY];
    if (
      typeof storedToken !== "string" ||
      !tokensEqual(storedToken, sourceMatch.queryDigest)
    ) {
      throw new BadRequestException("Invalid or expired temporary file URL");
    }

    if (sourceMetadata.ContentLength === undefined) {
      throw new Error(`S3 did not return a content length for ${fromKey}`);
    }

    if (sourceMetadata.ContentLength > MAX_SINGLE_COPY_SIZE) {
      throw new RangeError(
        `Storage copy source exceeds the 5 GB limit: ${fromKey}`,
      );
    }

    const contentType = resolveExternalContentType(
      sourceMetadata.ContentType
        ? normalizeMimeType(sourceMetadata.ContentType)
        : undefined,
      fromKey,
    );
    const effectiveMaxSize = this.resolveUploadSourceLimits(
      contentType,
      constraints,
      "The uploaded file does not meet the requirements",
    );
    if (sourceMetadata.ContentLength > effectiveMaxSize) {
      throw new BadRequestException("Temporary file exceeds maximum size");
    }

    const stagedExtension = extname(fromKey).replace(/^\.+/, "");
    const resolvedExtension =
      explicitExtension ??
      (stagedExtension && isValidPathSegment(stagedExtension)
        ? stagedExtension
        : resolveExternalExtension(contentType, fromKey));
    const toKey = `${PERMANENT_DIRECTORY}/${formatUtcDate(new Date())}/${randomUUID()}.${resolvedExtension}`;
    const destination = this.objectKey(toKey);
    const copySource = `${this.bucket}/${encodeStoragePath(source)}`;
    const copyDisposition = resolveSafeContentDisposition(
      contentType,
      sourceMetadata.ContentDisposition,
    );

    await this.internalClient.send(
      new CopyObjectCommand({
        Bucket: this.internalClientBucket,
        CacheControl: sourceMetadata.CacheControl ?? "no-store",
        ...(copyDisposition ? { ContentDisposition: copyDisposition } : {}),
        ...(sourceMetadata.ContentEncoding
          ? { ContentEncoding: sourceMetadata.ContentEncoding }
          : {}),
        ...(sourceMetadata.ContentLanguage
          ? { ContentLanguage: sourceMetadata.ContentLanguage }
          : {}),
        ContentType: contentType,
        CopySource: copySource,
        ...(sourceMetadata.ETag
          ? { CopySourceIfMatch: sourceMetadata.ETag }
          : {}),
        Key: destination,
        ...(stripInternalUploadMetadata(sourceMetadata.Metadata)
          ? { Metadata: stripInternalUploadMetadata(sourceMetadata.Metadata) }
          : {}),
        MetadataDirective: "REPLACE",
      }),
      { abortSignal },
    );

    return toKey;
  }

  private async createPresignedPostUpload(
    key: string,
    options: InternalPresignPostOptions,
  ): Promise<{ fields: Record<string, string>; url: string }> {
    const objectKey = this.objectKey(key);
    const upload = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: objectKey,
      Conditions: [
        ["eq", "$bucket", this.bucket],
        ["eq", "$key", objectKey],
        ...options.conditions,
      ],
      Fields: options.fields,
      Expires: options.expiresIn,
    });

    return this.client.config.bucketEndpoint && this.endpointUrl
      ? { ...upload, url: ensureTrailingSlash(this.endpointUrl) }
      : upload;
  }

  private async presignGetObject(
    key: string,
    options: InternalPresignGetOptions,
  ): Promise<string> {
    const { expiresIn, signingDate, ...getObjectOptions } = options;

    return await getSignedUrl(
      this.client,
      new GetObjectCommand({
        ...getObjectOptions,
        Bucket: this.clientBucket,
        Key: this.objectKey(key),
      }),
      {
        expiresIn,
        ...(signingDate === undefined ? {} : { signingDate }),
      },
    );
  }

  private async getTmpBaseUrls(): Promise<{
    clientBase: URL;
    internalBase?: URL;
  }> {
    if (!this.tmpBaseUrlsPromise) {
      const tmpPrefix = this.objectKey(TEMPORARY_DIRECTORY);
      const externalPromise = resolveS3PrefixBaseUrl(
        this.client,
        this.clientBucket,
        tmpPrefix,
      );
      const pending =
        this.internalClient === this.client
          ? externalPromise.then((clientBase) => ({ clientBase }))
          : Promise.all([
              externalPromise,
              resolveS3PrefixBaseUrl(
                this.internalClient,
                this.internalClientBucket,
                tmpPrefix,
              ),
            ]).then(([clientBase, internalBase]) => ({
              clientBase,
              internalBase,
            }));
      this.tmpBaseUrlsPromise = pending.catch((error: unknown) => {
        this.tmpBaseUrlsPromise = undefined;
        throw error;
      });
    }
    return await this.tmpBaseUrlsPromise;
  }

  // Matches only unexpired presigned GET `resourceUrl`s for UUIDv4 keys under `tmp/`,
  // verified via the S3-stored query commitment across replicas and STS credential rotations.
  private async matchOwnTemporaryUrl(
    url: string,
    abortSignal: AbortSignal,
  ): Promise<MatchedTemporarySource | undefined> {
    if (abortSignal.aborted) {
      throw asError(abortSignal.reason ?? new Error("Upload aborted."));
    }
    if (url.startsWith("/")) {
      throw new BadRequestException("Invalid file source URL");
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException("Invalid file source URL");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new BadRequestException("Invalid file source URL");
    }

    const { clientBase, internalBase } = await raceWithAbortSignal(
      this.getTmpBaseUrls(),
      abortSignal,
    );

    if (
      parsed.origin === clientBase.origin &&
      parsed.pathname.startsWith(clientBase.pathname)
    ) {
      const key = decodeTemporarySuffix(
        parsed.pathname.slice(clientBase.pathname.length),
      );
      assertUnexpiredPresignedQuery(parsed);
      return {
        key,
        queryDigest: hashTemporaryResourceQuery(parsed.search),
      };
    }

    if (
      parsed.origin === internalBase?.origin &&
      parsed.pathname.startsWith(internalBase.pathname)
    ) {
      throw new BadRequestException("Invalid or expired temporary file URL");
    }

    return undefined;
  }

  private extractDownloadPathname(url: string): string | undefined {
    if (url.startsWith("/") && !url.startsWith("//")) {
      return url.split(/[?#]/, 1)[0];
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return undefined;
      }
      if (this.downloadOrigin && parsed.origin !== this.downloadOrigin) {
        return undefined;
      }
      return parsed.pathname;
    } catch {
      return undefined;
    }
  }

  private downloadRoutePrefix(): string {
    return `${this.downloadBasePath}${this.appDownloadRoutePrefix()}`;
  }

  private appDownloadRoutePrefix(): string {
    const prefix =
      this.applicationConfig?.getGlobalPrefix().replace(/^\/+|\/+$/g, "") ?? "";
    const routePath = `/${this.downloadPath}/*key`;
    const excluded = this.applicationConfig
      ?.getGlobalPrefixOptions()
      .exclude?.some(
        (route) =>
          (route.requestMethod === RequestMethod.ALL ||
            route.requestMethod === RequestMethod.GET) &&
          route.pathRegex.test(routePath),
      );
    return prefix && !excluded
      ? `/${prefix}/${this.downloadPath}/`
      : `/${this.downloadPath}/`;
  }

  private isObjectKey(key: string): boolean {
    return (
      Boolean(key) &&
      !key.includes("\\") &&
      key.split("/").every((segment) => isValidPathSegment(segment))
    );
  }

  private async pipeObject(
    key: string,
    output: Writable,
    options: Omit<GetObjectCommandInput, "Bucket" | "Key">,
    signal: AbortSignal,
  ): Promise<void> {
    const result = await this.internalClient.send(
      new GetObjectCommand({
        ...options,
        Bucket: this.internalClientBucket,
        Key: this.objectKey(key),
      }),
      { abortSignal: signal },
    );

    if (!(result.Body instanceof Readable)) {
      throw new Error(`S3 returned a non-Node.js stream body for ${key}`);
    }

    await pipeline(result.Body, output, { signal });
  }

  private objectKey(path: string): string {
    const relative = normalizeStoragePath(path);
    if (!relative) {
      throw new TypeError("Storage path must not be empty");
    }

    return this.rootPath ? `${this.rootPath}/${relative}` : relative;
  }
}

/**
 * Normalizes a MIME type string by stripping parameters and lowercasing.
 * @param mimeType - Raw MIME type string.
 * @returns Normalized `type/subtype` string.
 */
function normalizeMimeType(mimeType: string): string {
  return (mimeType.split(";", 1)[0] ?? "").trim().toLowerCase();
}

/**
 * Decodes and validates the object suffix beneath `tmp/` from a matched S3 URL.
 * @param encodedSuffix - Percent-encoded path suffix after `.../tmp/`.
 * @returns Validated `tmp/<segments>` storage key.
 */
function decodeTemporarySuffix(encodedSuffix: string): string {
  if (!encodedSuffix || encodedSuffix.includes("/")) {
    throw new BadRequestException("Invalid file source URL");
  }

  let filename: string;
  try {
    filename = decodeURIComponent(encodedSuffix);
  } catch {
    throw new BadRequestException("Invalid file source URL");
  }

  if (
    !isValidPathSegment(filename) ||
    !UUID_V4_FILENAME_PATTERN.test(filename)
  ) {
    throw new BadRequestException("Invalid file source URL");
  }

  return `${TEMPORARY_DIRECTORY}/${filename}`;
}

/**
 * Computes a SHA-256 hex digest of the signed `resourceUrl` query string.
 * @param search - Raw `URL.search` string including leading `?`.
 * @returns Hex-encoded SHA-256 digest.
 */
function hashTemporaryResourceQuery(search: string): string {
  return createHash("sha256").update(search).digest("hex");
}

/**
 * Compares two digest strings in constant time.
 * @param left - Stored metadata token digest.
 * @param right - Presented query string digest.
 * @returns True when both strings are identical.
 */
function tokensEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left, "utf8");
  const rightBuf = Buffer.from(right, "utf8");
  return (
    leftBuf.byteLength === rightBuf.byteLength &&
    timingSafeEqual(leftBuf, rightBuf)
  );
}

/**
 * Validates that a candidate `resourceUrl` carries non-empty, unexpired SigV4 query parameters.
 * @param parsed - Parsed candidate `resourceUrl`.
 */
function assertUnexpiredPresignedQuery(parsed: URL): void {
  const amzDate = parsed.searchParams.get("X-Amz-Date");
  const amzExpires = parsed.searchParams.get("X-Amz-Expires");
  const signature = parsed.searchParams.get("X-Amz-Signature");
  const signedAtMs = amzDate ? parseAmzIsoBasicDate(amzDate) : Number.NaN;
  const expiresIn = Number(amzExpires);
  const now = Date.now();

  if (
    !signature?.trim() ||
    !Number.isFinite(signedAtMs) ||
    !isValidLifetimeSeconds(expiresIn) ||
    signedAtMs > now + MAX_CLOCK_SKEW_MS ||
    signedAtMs + expiresIn * 1000 <= now
  ) {
    throw new BadRequestException("Invalid or expired temporary file URL");
  }
}

/**
 * Removes internal temporary upload token metadata before copying to permanent storage.
 * @param metadata - Source S3 user metadata dictionary.
 * @returns Cleaned user metadata, or `undefined` when empty.
 */
function stripInternalUploadMetadata(
  metadata: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }
  const entries = Object.entries(metadata).filter(
    ([key]) => key !== STORAGE_TOKEN_META_KEY,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Parses an AWS SigV4 basic ISO-8601 timestamp (`YYYYMMDDTHHMMSSZ`) into epoch milliseconds.
 * @param value - Raw `X-Amz-Date` query value.
 * @returns Epoch timestamp in milliseconds, or `NaN` when malformed.
 */
function parseAmzIsoBasicDate(value: string): number {
  const match =
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value) ?? undefined;
  if (!match) {
    return Number.NaN;
  }
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
}

/**
 * Destroys a Readable stream with an error while guaranteeing at least one `'error'` listener
 * is attached so Node.js never terminates with an unhandled `'error'` event.
 * @param stream - Readable stream to destroy.
 * @param error - Abort error to pass to `destroy`.
 */
function destroyReadableSafely(stream: Readable, error: Error): void {
  if (stream.listenerCount("error") === 0) {
    stream.on("error", () => undefined);
  }
  if (!stream.destroyed) {
    stream.destroy(error);
  }
}

/**
 * Validates and normalizes an explicit file extension override (stripping leading dots).
 * @param explicitExtension - Raw extension string provided by the caller.
 * @returns Validated extension without leading dots.
 */
function normalizeExplicitExtension(explicitExtension: string): string {
  if (typeof explicitExtension !== "string") {
    throw new BadRequestException("Invalid file extension");
  }
  const normalized = explicitExtension.replace(/^\.+/, "");
  if (!normalized || !isValidPathSegment(normalized)) {
    throw new BadRequestException("Invalid file extension");
  }
  return normalized;
}

/**
 * Checks whether a `Content-Disposition` header forces download as an attachment.
 * @param disposition - Raw `Content-Disposition` header string.
 * @returns True when the disposition type is `attachment`.
 */
function isAttachmentDisposition(disposition: string): boolean {
  return (
    (disposition.split(";", 1)[0] ?? "").trim().toLowerCase() === "attachment"
  );
}

/**
 * Ensures active or unknown MIME types always store an `attachment` `Content-Disposition`.
 * @param mimeType - Object MIME type.
 * @param existingDisposition - Optional caller- or source-provided `Content-Disposition`.
 * @returns Safe `Content-Disposition` header value, or `undefined` when inline preview is safe.
 */
function resolveSafeContentDisposition(
  mimeType: string,
  existingDisposition?: string,
): string | undefined {
  if (isSafeInlinePreviewMimeType(normalizeMimeType(mimeType))) {
    return existingDisposition;
  }
  return existingDisposition && isAttachmentDisposition(existingDisposition)
    ? existingDisposition
    : "attachment";
}

/**
 * Races an async operation against an `AbortSignal`.
 * @param promise - Operation to await.
 * @param signal - Abort signal to observe.
 * @returns Resolved value of `promise`.
 */
async function raceWithAbortSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    promise.catch(() => undefined);
    throw asError(signal.reason ?? new Error("Upload aborted."));
  }
  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      promise.catch(() => undefined);
      reject(asError(signal.reason ?? new Error("Upload aborted.")));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(asError(error));
      },
    );
  });
}

/**
 * Resolves the MIME type for a fetched external file using response headers or URL extension.
 * @param responseContentType - Normalized `Content-Type` header from the remote server.
 * @param pathname - Final URL pathname.
 * @returns Resolved MIME type.
 */
function resolveExternalContentType(
  responseContentType: string | undefined,
  pathname: string,
): string {
  if (
    responseContentType &&
    responseContentType !== "application/octet-stream"
  ) {
    return responseContentType;
  }
  const lookedUp = mimeTypes.lookup(pathname);
  return lookedUp !== false
    ? lookedUp
    : (responseContentType ?? "application/octet-stream");
}

/**
 * Resolves the file extension for a fetched external file.
 * @param contentType - Resolved MIME type.
 * @param pathname - Final URL pathname.
 * @param explicitExtension - Optional caller-provided extension override.
 * @returns Sanitized file extension without a leading dot.
 */
function resolveExternalExtension(
  contentType: string,
  pathname: string,
  explicitExtension?: string,
): string {
  if (explicitExtension !== undefined) {
    return resolveUploadExtension(contentType, explicitExtension);
  }
  if (contentType !== "application/octet-stream") {
    const inferred = mimeTypes.extension(contentType);
    if (inferred !== false && isValidPathSegment(inferred)) {
      return inferred;
    }
  }
  const urlExt = extname(pathname).replace(/^\.+/, "");
  return urlExt && isValidPathSegment(urlExt) ? urlExt : "bin";
}

/**
 * Validates that a signature lifetime in seconds is within the S3 7-day bound.
 * @param expiresIn - Lifetime in seconds.
 * @returns True when `expiresIn` is a safe integer between 1 and 604800.
 */
function isValidLifetimeSeconds(expiresIn: number): boolean {
  return (
    Number.isSafeInteger(expiresIn) &&
    expiresIn >= 1 &&
    expiresIn <= MAX_PRESIGNED_LIFETIME
  );
}

/**
 * Formats a date as a UTC `YYYY/MM/DD` directory prefix.
 * @param date - Timestamp to format.
 * @returns UTC date path segments.
 */
function formatUtcDate(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Resolves and validates the file extension for server-side uploads.
 * @param contentType - MIME type supplied by the caller.
 * @param explicitExtension - Optional caller-provided extension.
 * @returns Sanitized file extension without a leading dot.
 */
function resolveUploadExtension(
  contentType: string,
  explicitExtension?: string,
): string {
  if (typeof contentType !== "string" || !contentType.trim()) {
    throw new BadRequestException("Storage upload contentType is required");
  }

  const inferred = mimeTypes.extension(contentType);
  const normalizedExplicit = explicitExtension?.replace(/^\.+/, "");
  const extension =
    explicitExtension !== undefined
      ? normalizedExplicit
      : inferred !== false
        ? inferred
        : "bin";

  if (!extension || !isValidPathSegment(extension)) {
    throw new BadRequestException("Invalid file extension");
  }

  return extension;
}

/**
 * Returns whether a path segment is non-empty and free of traversal or separators.
 * @param segment - Single path component to validate.
 * @returns True when the segment is safe for a storage path.
 */
function isValidPathSegment(segment: string): boolean {
  return (
    Boolean(segment) &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\")
  );
}
