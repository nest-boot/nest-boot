import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Client } from "minio";
import { extname } from "path";

import { FileUploadInput } from "./file-upload.input";
import { MODULE_OPTIONS_TOKEN } from "./file-upload.module-definition";
import { FileUpload } from "./file-upload.object";
import { FileUploadModuleOptions } from "./file-upload-options.interface";

@Injectable()
export class FileUploadService {
  public readonly ossClient: Client;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    public readonly options: FileUploadModuleOptions,
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

  // 不能使用 minio 的 copyObject(),因为它会把原文件的策略也拷贝（aws-sdk 的 copyObject() 可以添加策略参数）
  // 并且 minio 只支持对 bucket 的策略配置，不支持对某对象进行策略配置
  async copyObject(originPath: string, filename: string): Promise<string> {
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

    // 上传对象
    const metaData = {
      "Content-Type": originMetadata.metaData["content-type"],
    };

    // 无法设置 acl 等策略，会自动继承 files 目录的策略
    await this.ossClient.putObject(
      this.options.bucket,
      filename,
      data,
      metaData,
    );

    return this.options.pathStyle
      ? `https://${this.options.endPoint}/${this.options.bucket}/${filename}`
      : `https://${this.options.bucket}.${this.options.endPoint}/${filename}`;
  }
}
