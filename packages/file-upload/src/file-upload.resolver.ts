import { Args, Mutation, Resolver } from "@nestjs/graphql";

import { FileUpload } from "./file-upload.object";
import { FileUploadService } from "./file-upload.service";
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
}
