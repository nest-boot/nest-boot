import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import { Client, ItemBucketMetadata, UploadedObjectInfo } from "minio";
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
    const acl = "private";

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
        acl,
        bucket: this.options.bucket,
        key,
        success_action_status: "201",
        "Content-Type": item.mimeType,
      };

      policy.policy = {
        conditions: [
          ...(limit ? [["content-length-range", 1, limit.fileSize]] : []),
          ["eq", "$acl", acl],
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
    const originPath = "tmp/" + tmpUrl.split("/tmp/")[1];

    const targetPath = `files/${dayjs().format("YYYY/MM/DD")}/${originPath
      .split("/")
      .pop()}`;

    return await this.copyObject(originPath, targetPath);
  }

  async upload(
    filePath: string,
    data: ReadableStream | Buffer | string,
    metaData: ItemBucketMetadata,
  ): Promise<string> {
    await (
      this.ossClient.putObject as (
        bucketName: string,
        objectName: string,
        stream: ReadableStream | Buffer | string,
        metaData?: ItemBucketMetadata,
      ) => Promise<UploadedObjectInfo>
    )(this.options.bucket, filePath, data, metaData);

    return this.options.pathStyle
      ? `${this.options.useSSL !== false ? "https" : "http"}://${this.options.endPoint}${this.options.port ? `:${this.options.port}` : ""}/${this.options.bucket}/${filePath}`
      : `${this.options.useSSL !== false ? "https" : "http"}://${this.options.bucket}.${this.options.endPoint}${this.options.port ? `:${this.options.port}` : ""}/${filePath}`;
  }

  // 不能使用 minio 的 copyObject(),因为它会把原文件的策略也拷贝（aws-sdk 的 copyObject() 可以添加策略参数）
  // 并且 minio 只支持对 bucket 的策略配置，不支持对某对象进行策略配置
  private async copyObject(
    originPath: string,
    targetPath: string,
  ): Promise<string> {
    const originMetadata = await this.ossClient.statObject(
      this.options.bucket,
      originPath,
    );

    const dataStream = await this.ossClient.getObject(
      this.options.bucket,
      originPath,
    );

    const data = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      dataStream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      dataStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      dataStream.on("error", reject);
    });

    const metaData = {
      "Content-Type": originMetadata.metaData["content-type"],
    };

    // 上传文件
    return await this.upload(targetPath, data, metaData);
  }
}
