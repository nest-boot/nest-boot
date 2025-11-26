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

@Injectable()
export class FileUploadService {
  private readonly s3Client: S3Client;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: FileUploadModuleOptions,
  ) {
    this.s3Client =
      options.client instanceof S3Client
        ? options.client
        : new S3Client(options.client);
  }

  async create(input: FileUploadInput[]): Promise<FileUpload[]> {
    const results = input.map(async (item) => {
      const key = `tmp/${randomUUID()}${extname(item.name)}`;

      const limit = this.options.limits?.find(
        (v) =>
          item.fileSize <= v.fileSize &&
          micromatch.isMatch(item.mimeType, v.mimeTypes),
      );

      if (this.options.limits && !limit) {
        // 上传的文件不符合要求
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

  // 临时文件转永久文件
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

    // 持久化
    return await this.persist(tmpUrl);
  }

  private async getFileUrl(filePath: string): Promise<string> {
    // 获取 S3Client 的配置
    const config = this.s3Client.config;
    const forcePathStyle = config.forcePathStyle;
    const endpoint = await config.endpoint?.();

    if (!endpoint) {
      throw new Error("Endpoint is not configured");
    }

    // 构造基础 URL
    const protocol = endpoint.protocol;
    const hostname = endpoint.hostname;
    const port = endpoint.port ? `:${String(endpoint.port)}` : "";
    const baseUrl = `${protocol}//${hostname}${port}`;

    // 根据配置生成正确的 URL
    if (forcePathStyle) {
      // Path-style URL: https://endpoint/bucket/key
      return `${baseUrl}/${this.options.bucket}/${filePath}`;
    } else {
      // Virtual-hosted-style URL: https://bucket.endpoint/key
      return `${protocol}//${this.options.bucket}.${hostname}${port}/${filePath}`;
    }
  }
}
