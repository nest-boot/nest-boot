import { Args, Mutation, Resolver } from "@nestjs/graphql";
import moment from "moment";

import { FileUpload } from "./file-upload.object";
import { FileUploadService } from "./file-upload.service";
import { CreateAbsoluteFileInput } from "./inputs/create-absolute-file.input";
import { FileUploadInput } from "./inputs/file-upload.input";

@Resolver(() => FileUpload)
export class FileUploadResolver {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Mutation(() => [FileUpload])
  async createFileUploads(
    @Args({ type: () => [FileUploadInput], name: "input" })
    input: FileUploadInput[],
  ): Promise<FileUpload[]> {
    return await this.fileUploadService.create(input);
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
    const filePath = "tmp/" + tempUrl.split("/tmp/")[1];
    const filename = `files/${moment().format("YYYY/MM/DD")}/${filePath
      .split("/")
      .pop()}`;

    return await this.fileUploadService.copyObject(filePath, filename);
  }
}
