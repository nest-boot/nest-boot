import { ConfigService } from "@nestjs/config";
import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { S3 } from "aws-sdk";
import moment from "moment";

import { FileUpload } from "./file-upload.object";
import { FileUploadService } from "./file-upload.service";
import { CreateAbsoluteFileInput } from "./inputs/create-absolute-file.input";
import { FileUploadInput } from "./inputs/file-upload.input";

@Resolver(() => FileUpload)
export class FileUploadResolver {
  private readonly s3: S3;

  private bucketName: string;

  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly configService: ConfigService,
  ) {
    this.s3 = new S3({
      endpoint: configService
        .get("S3_ENDPOINT")
        ?.split(".")
        ?.splice(1)
        ?.join("."),
      accessKeyId: configService.get("S3_ACCESS_KEY_ID"),
      secretAccessKey: configService.get("S3_SECRET_KEY"),
    });

    const bucketName = configService.get("S3_BUCKET");

    if (typeof bucketName === "undefined") {
      throw new Error("Environment variable S3_BUCKET is not found");
    }

    this.bucketName = bucketName;
  }

  @Mutation(() => [FileUpload])
  createFileUploads(
    @Args({ type: () => [FileUploadInput], name: "input" })
    input: FileUploadInput[],
  ): FileUpload[] {
    return this.fileUploadService.create(input);
  }

  @Mutation(() => String)
  async createAbsoluteFile(
    @Args({ type: () => CreateAbsoluteFileInput, name: "input" })
    input: CreateAbsoluteFileInput,
  ): Promise<string> {
    return await this.tmpAssetToFileAsset(input.path);
  }

  // 将临时资源转文件模块资源
  private async tmpAssetToFileAsset(tempUrl: string) {
    // 去除开头带斜杆
    const filePath = new URL(tempUrl).pathname?.slice(1);

    const { Body, ContentType } = await this.s3
      .getObject({
        Bucket: this.bucketName,
        Key: filePath,
      })
      .promise();

    const filename = `files/${moment().format("YYYY/MM/DD")}/${filePath
      .split("/")
      .pop()}`;

    const uploadInfo = await this.s3
      .upload({
        Bucket: this.bucketName,
        Key: filename,
        Body,
        ContentType,
      })
      .promise();

    return uploadInfo.Location;
  }
}
