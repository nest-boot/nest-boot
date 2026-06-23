import { Args, Mutation, Resolver } from "@nest-boot/graphql";

import { FileUpload } from "./file-upload.object.js";
import { FileUploadService } from "./file-upload.service.js";
import { FileUploadInput } from "./inputs/file-upload.input.js";

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
