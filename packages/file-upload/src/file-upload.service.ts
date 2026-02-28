import {
  CopyObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import micromatch from "micromatch";
import mimeTypes from "mime-types";
import { extname } from "path";
import { Readable } from "stream";

import { MODULE_OPTIONS_TOKEN } from "./file-upload.module-definition";
import { FileUpload } from "./file-upload.object";
import { FileUploadModuleOptions } from "./file-upload-options.interface";
import { FileUploadInput } from "./inputs/file-upload.input";

/**
 * Service for handling file uploads to S3-compatible storage.
 *
 * @remarks
 * Supports presigned POST uploads, direct uploads, and
 * moving temporary files to permanent storage paths.
 */
@Injectable()
export class FileUploadService {
  /** S3 client instance. @internal */ private readonly s3Client: S3Client;

  /** Creates a new FileUploadService instance.
   * @param options - File upload module configuration options
   */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: FileUploadModuleOptions,
  ) {
    this.s3Client =
      options.client instanceof S3Client
        ? options.client
        : new S3Client(options.client);
  }

  /**
   * Creates presigned POST URLs for uploading files.
   * @param input - Array of file upload inputs with name, size, and MIME type
   * @returns An array of presigned POST data (URL and form fields)
   */
  async create(input: FileUploadInput[]): Promise<FileUpload[]> {
    const results = input.map(async (item) => {
      const key = `tmp/${randomUUID()}${extname(item.name)}`;

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

      const conditions: any[] = [
        ...(limit ? [["content-length-range", 1, limit.fileSize]] : []),
        ["eq", "$bucket", this.options.bucket],
        ["eq", "$key", key],
        ["eq", "$success_action_status", "201"],
        ["eq", "$Content-Type", item.mimeType],
      ];

      const presignedPost = await createPresignedPost(this.s3Client, {
        Bucket: this.options.bucket,
        Key: key,
        Conditions: conditions as any,
        Fields: {
          success_action_status: "201",
          "Content-Type": item.mimeType,
        },
        Expires: this.options.expires ?? 3600,
      });

      return {
        url: this.options.url
          ? (() => {
              const originalUrl = new URL(presignedPost.url);
              const customUrl = new URL(this.options.url);
              return `${customUrl.origin}${originalUrl.pathname}${originalUrl.search}`;
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
   * Moves a temporary file to permanent storage.
   * @param tmpUrl - The URL of the temporary file
   * @returns The permanent URL of the file
   */
  async persist(tmpUrl: string): Promise<string> {
    const tmpKey = tmpUrl.split("/tmp/")[1];
    const originKey = `tmp/${tmpKey}`;

    const targetKey = `files/${dayjs().format("YYYY/MM/DD")}/${tmpKey}`;

    const copyCommand = new CopyObjectCommand({
      Bucket: this.options.bucket,
      CopySource: `${this.options.bucket}/${originKey}`,
      Key: targetKey,
    });

    await this.s3Client.send(copyCommand);

    return await this.getFileUrl(targetKey);
  }

  /**
   * Uploads file data directly to S3.
   * @param data - File content as a Readable stream, Buffer, or string
   * @param metadata - Upload metadata including Content-Type and optional extension
   * @param persist - Whether to move the file to permanent storage immediately
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

    const filePath = `tmp/${dayjs().format("YYYY/MM/DD")}/${randomUUID()}.${extension}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: filePath,
        Body: data,
        ContentType: metadata["Content-Type"],
        Metadata: metadata,
      }),
    );

    const tmpUrl = await this.getFileUrl(filePath);

    if (!persist) {
      return tmpUrl;
    }

    return await this.persist(tmpUrl);
  }

  /** Constructs the full URL for a file stored in S3. @internal */
  private async getFileUrl(filePath: string): Promise<string> {
    const config = this.s3Client.config;
    const forcePathStyle = config.forcePathStyle;
    const endpoint = await config.endpoint?.();

    if (!endpoint) {
      throw new Error("Endpoint is not configured");
    }

    const protocol = endpoint.protocol;
    const hostname = endpoint.hostname;
    const port = endpoint.port ? `:${String(endpoint.port)}` : "";
    const baseUrl = `${protocol}//${hostname}${port}`;

    if (forcePathStyle) {
      return `${baseUrl}/${this.options.bucket}/${filePath}`;
    } else {
      return `${protocol}//${this.options.bucket}.${hostname}${port}/${filePath}`;
    }
  }
}
