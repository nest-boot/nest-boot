import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { AWSError, S3 } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { randomUUID } from "crypto";
import _ from "lodash";
import { extname } from "path";

import { FileUploadInput } from "./file-upload.input";
import { MODULE_OPTIONS_TOKEN } from "./file-upload.module-definition";
import { FileUpload } from "./file-upload.object";
import { FileUploadModuleOptions } from "./file-upload-options.interface";

@Injectable()
export class FileUploadService {
  private readonly s3: S3;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: FileUploadModuleOptions,
  ) {
    this.s3 = new S3(options);
  }

  create(input: FileUploadInput[]): FileUpload[] {
    const acl = "private";
    return input.map((item) => {
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

      const presignedPost = this.s3.createPresignedPost({
        Bucket: this.options.bucket,
        Expires: this.options.expires,
        Fields: {
          acl,
          key,
          success_action_status: "201",
          "Content-Type": item.mimeType,
        },
        Conditions: [
          ...(limit ? [["content-length-range", 1, limit.fileSize]] : []),
          ["eq", "$acl", acl],
          ["eq", "$key", key],
          ["eq", "$success_action_status", "201"],
          ["eq", "$Content-Type", item.mimeType],
        ],
      });

      return {
        url: new URL(presignedPost.url).origin,
        fields: [
          { name: "key", value: presignedPost.fields.key },
          ...Object.entries(_.omit(presignedPost.fields, "key")).map(
            ([name, value]) => ({
              name,
              value,
            }),
          ),
        ],
      };
    });
  }

  async upload(
    params: S3.PutObjectRequest,
    options?: S3.ManagedUpload.ManagedUploadOptions,
    callback?: (err: Error, data: S3.ManagedUpload.SendData) => void,
  ): Promise<S3.ManagedUpload.SendData> {
    return await this.s3.upload(params, options, callback).promise();
  }

  async getObject(
    params: S3.GetObjectRequest,
    callback?: (err: AWSError, data: S3.GetObjectOutput) => void,
  ): Promise<PromiseResult<S3.GetObjectOutput, AWSError>> {
    return await this.s3.getObject(params, callback).promise();
  }
}
