import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import {
  Client,
  CopyConditions,
  ItemBucketMetadata,
  UploadedObjectInfo,
} from "minio";
import { extname } from "path";

import { MODULE_OPTIONS_TOKEN } from "./file-upload.module-definition";
import { FileUpload } from "./file-upload.object";
import { FileUploadModuleOptions } from "./file-upload-options.interface";
import { FileUploadInput } from "./inputs/file-upload.input";

@Injectable()
export class FileUploadService {
  readonly ossClient: Client;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    readonly options: FileUploadModuleOptions,
  ) {
    this.ossClient = new Client(options);
  }

  async create(input: FileUploadInput[]): Promise<FileUpload[]> {
    const results = input.map(async (item) => {
      const key = `tmp/${randomUUID()}${extname(item.name)}`;

      const limit = this.options.limits?.find(
        (v) =>
          item.fileSize <= v.fileSize && v.mimeTypes.includes(item.mimeType),
      );

      if (this.options.limits && !limit) {
        // 上传的文件不符合要求
        throw new BadRequestException(
          "The uploaded file does not meet the requirements",
        );
      }

      const policy = this.ossClient.newPostPolicy();

      policy.formData = {
        bucket: this.options.bucket,
        key,
        success_action_status: "201",
        "Content-Type": item.mimeType,
      };

      policy.policy = {
        conditions: [
          ...(limit ? [["content-length-range", 1, limit.fileSize]] : []),
          ["eq", "$bucket", this.options.bucket],
          ["eq", "$key", key],
          ["eq", "$success_action_status", "201"],
          ["eq", "$Content-Type", item.mimeType],
        ],
        // 上传链接的过期时间，不是临时文件的过期时间
        expiration: new Date(
          Date.now() + (this.options.expires ?? 3600) * 1000,
        ).toISOString(),
      };

      const presignedPost = await this.ossClient.presignedPostPolicy(policy);

      return {
        url: presignedPost.postURL,
        fields: [
          { name: "key", value: presignedPost.formData.key },
          ...Object.entries(presignedPost.formData)
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
    const originPath = `${this.options.bucket}/tmp/${tmpUrl.split("/tmp/")[1]}`;

    const targetPath = `files/${dayjs().format("YYYY/MM/DD")}/${originPath
      .split("/")
      .pop()}`;

    const conditions = new CopyConditions();

    await this.ossClient.copyObject(
      this.options.bucket,
      targetPath,
      originPath,
      conditions,
    );

    return this.options.pathStyle
      ? `${this.options.useSSL !== false ? "https" : "http"}://${this.options.endPoint}${this.options.port ? `:${this.options.port}` : ""}/${this.options.bucket}/${targetPath}`
      : `${this.options.useSSL !== false ? "https" : "http"}://${this.options.bucket}.${this.options.endPoint}${this.options.port ? `:${this.options.port}` : ""}/${targetPath}`;
  }

  async upload(
    data: ReadableStream | Buffer | string,
    metadata: ItemBucketMetadata & { "Content-Type": string },
    persist = false,
  ): Promise<string> {
    const filePath = `tmp/${dayjs().format("YYYY/MM/DD")}/${randomUUID()}.${metadata["Content-Type"].split("/").pop()}`;

    await (
      this.ossClient.putObject as (
        bucketName: string,
        objectName: string,
        stream: ReadableStream | Buffer | string,
        metadata?: ItemBucketMetadata,
      ) => Promise<UploadedObjectInfo>
    )(this.options.bucket, filePath, data, metadata);

    const tmpUrl = this.options.pathStyle
      ? `${this.options.useSSL !== false ? "https" : "http"}://${this.options.endPoint}${this.options.port ? `:${this.options.port}` : ""}/${this.options.bucket}/${filePath}`
      : `${this.options.useSSL !== false ? "https" : "http"}://${this.options.bucket}.${this.options.endPoint}${this.options.port ? `:${this.options.port}` : ""}/${filePath}`;

    if (!persist) {
      return tmpUrl;
    }

    // 持久化
    return await this.persist(tmpUrl);
  }
}
