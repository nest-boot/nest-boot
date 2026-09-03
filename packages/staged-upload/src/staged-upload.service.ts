import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { Readable } from "node:stream";

import {
  Storage,
  type StorageTemporaryUploadUrlOptions,
} from "@nest-boot/storage";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import micromatch from "micromatch";
import mimeTypes from "mime-types";

import {
  type StagedUploadRequest,
  type StagedUploadResult,
} from "./interfaces/staged-upload.interface.js";
import { MODULE_OPTIONS_TOKEN } from "./staged-upload.module-definition.js";
import { type StagedUploadModuleOptions } from "./staged-upload-options.interface.js";

/**
 * Service for staging uploads in S3-compatible storage.
 *
 * @remarks
 * Supports presigned POST uploads, direct uploads, and
 * promoting temporary files to permanent storage paths.
 */
@Injectable()
export class StagedUploadService {
  private readonly permanentPath: string;
  private readonly temporaryPath: string;
  private readonly temporaryPathSegments: string[];

  /** Creates a new StagedUploadService instance.
   * @param options - Staged upload module configuration options
   * @param storage - Storage service provided by the global StorageModule
   */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: StagedUploadModuleOptions,
    private readonly storage: Storage,
  ) {
    this.temporaryPath = normalizeConfiguredPath(
      options.temporaryPath ?? "/tmp",
      "temporaryPath",
    );
    this.permanentPath = normalizeConfiguredPath(
      options.permanentPath ?? "/files",
      "permanentPath",
    );
    this.temporaryPathSegments = this.temporaryPath.split("/");
  }

  /**
   * Creates presigned POST URLs for uploading files.
   * @param input - Upload requests with names, sizes, and MIME types
   * @returns An array of presigned POST data (URL and form fields)
   */
  async create(input: StagedUploadRequest[]): Promise<StagedUploadResult[]> {
    const results = input.map(async (item) => {
      const path = `${this.temporaryPath}/${randomUUID()}${extname(item.name)}`;

      const limit = this.options.limits?.find(
        (v) =>
          item.fileSize <= v.fileSize &&
          micromatch.isMatch(item.mimeType, v.mimeTypes),
      );

      if (this.options.limits && !limit) {
        throw new BadRequestException(
          "The uploaded file does not meet the requirements",
        );
      }

      const conditions: NonNullable<
        StorageTemporaryUploadUrlOptions["conditions"]
      > = [
        ["eq", "$success_action_status", "201"],
        ["eq", "$Content-Type", item.mimeType],
      ];
      if (limit) {
        conditions.unshift(["content-length-range", 1, limit.fileSize]);
      }

      const presignedPost = await this.storage.createTemporaryUploadUrl(path, {
        conditions,
        expiresIn: this.options.expires ?? 3600,
        fields: {
          success_action_status: "201",
          "Content-Type": item.mimeType,
        },
      });

      return {
        url: this.options.url
          ? (() => {
              const originalUrl = new URL(presignedPost.url);
              const customUrl = new URL(this.options.url);
              const customPathname = customUrl.pathname.replace(/\/$/, "");
              return `${customUrl.origin}${customPathname}${originalUrl.pathname}${originalUrl.search}`;
            })()
          : presignedPost.url,
        fields: [
          { name: "key", value: presignedPost.fields.key },
          ...Object.entries(presignedPost.fields)
            .filter(([name]) => name !== "key")
            .map(([name, value]) => ({
              name,
              value,
            })),
        ],
      };
    });

    return await Promise.all(results);
  }

  /**
   * Copies a temporary upload to permanent storage.
   * @param temporaryUrl - URL returned after the temporary upload completes
   * @returns The permanent URL of the file
   */
  async persist(temporaryUrl: string): Promise<string> {
    return await this.persistPath(this.temporaryPathFromUrl(temporaryUrl));
  }

  /**
   * Uploads file data directly to the configured storage.
   * @param data - File content as a Readable stream, Buffer, or string
   * @param metadata - Upload metadata including Content-Type and optional extension
   * @param persist - Whether to copy the file to permanent storage immediately
   * @returns The URL of the uploaded file
   */
  async upload(
    data: Readable | Buffer | string,
    metadata: {
      "Content-Type": string;
      extension?: string;
      [key: string]: any;
    },
    persist = false,
  ): Promise<string> {
    const extension: string =
      metadata.extension ??
      (mimeTypes.extension(metadata["Content-Type"]) || "bin");
    if (!extension || extension.includes("/") || extension.includes("\\")) {
      throw new BadRequestException("Invalid file extension");
    }

    const filePath = `${this.temporaryPath}/${randomUUID()}.${extension}`;

    await this.storage.writeFile(filePath, data, {
      ContentType: metadata["Content-Type"],
      Metadata: metadata,
    });

    return persist
      ? await this.persistPath(filePath)
      : await this.getFileUrl(filePath);
  }

  /** Constructs the full URL for a stored file. @internal */
  private async getFileUrl(filePath: string): Promise<string> {
    return await this.storage.getUrl(filePath);
  }

  /** Copies a storage-relative temporary path to its permanent dated path. */
  private async persistPath(temporaryPath: string): Promise<string> {
    const temporaryPrefix = `${this.temporaryPath}/`;
    if (!temporaryPath.startsWith(temporaryPrefix)) {
      throw new BadRequestException("Invalid temporary upload path");
    }

    const temporaryKey = temporaryPath.slice(temporaryPrefix.length);
    if (!temporaryKey) {
      throw new BadRequestException("Invalid temporary upload path");
    }

    const targetPath = `${this.permanentPath}/${dayjs().format("YYYY/MM/DD")}/${temporaryKey}`;
    await this.storage.copyFile(temporaryPath, targetPath);

    return await this.getFileUrl(targetPath);
  }

  /** Extracts the storage-relative temporary path from an uploaded object URL. */
  private temporaryPathFromUrl(temporaryUrl: string): string {
    let segments: string[];

    try {
      const url = temporaryUrl.startsWith("/")
        ? new URL(temporaryUrl, "http://storage.local")
        : new URL(temporaryUrl);
      segments = url.pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment));
    } catch {
      throw new BadRequestException("Invalid temporary upload URL");
    }

    const temporaryIndex = findLastPathSequence(
      segments,
      this.temporaryPathSegments,
    );
    const objectSegments = segments.slice(
      temporaryIndex + this.temporaryPathSegments.length,
    );
    if (
      temporaryIndex < 0 ||
      objectSegments.length < 1 ||
      objectSegments.some((segment) => !isValidPathSegment(segment))
    ) {
      throw new BadRequestException("Invalid temporary upload URL");
    }

    return `${this.temporaryPath}/${objectSegments.join("/")}`;
  }
}

function normalizeConfiguredPath(path: string, optionName: string): string {
  const segments = path.split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => !isValidPathSegment(segment))
  ) {
    throw new Error(`${optionName} must contain valid storage path segments`);
  }

  return segments.join("/");
}

function findLastPathSequence(
  pathSegments: string[],
  expectedSegments: string[],
): number {
  for (
    let index = pathSegments.length - expectedSegments.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (
      expectedSegments.every(
        (expected, offset) => pathSegments[index + offset] === expected,
      )
    ) {
      return index;
    }
  }

  return -1;
}

function isValidPathSegment(segment: string): boolean {
  return (
    Boolean(segment) &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\")
  );
}
