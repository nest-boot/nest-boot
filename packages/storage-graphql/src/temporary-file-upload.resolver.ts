import { Args, Mutation, Resolver } from "@nest-boot/graphql";
import {
  MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE,
  StorageService,
} from "@nest-boot/storage";
import { BadRequestException } from "@nestjs/common";

import { TemporaryFileUploadInput } from "./inputs/temporary-file-upload.input.js";
import { TemporaryFileUploadUrl } from "./temporary-file-upload-url.object.js";

/** GraphQL resolver for creating temporary file upload URLs. */
@Resolver(() => TemporaryFileUploadUrl)
export class TemporaryFileUploadResolver {
  /**
   * Creates a TemporaryFileUploadResolver instance.
   * @param storageService - Globally registered storage service.
   */
  constructor(private readonly storageService: StorageService) {}

  /**
   * Creates presigned POST targets in `tmp/` for the requested files.
   * @param input - File metadata entries to validate and stage.
   * @returns Presigned temporary upload keys, URLs, and form fields.
   */
  @Mutation(() => [TemporaryFileUploadUrl])
  async createTemporaryFileUploadUrls(
    @Args({ type: () => [TemporaryFileUploadInput], name: "input" })
    input: TemporaryFileUploadInput[],
  ): Promise<TemporaryFileUploadUrl[]> {
    if (input.length > MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE) {
      throw new BadRequestException(
        `Cannot create more than ${String(MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE)} temporary file upload URLs per request`,
      );
    }

    return await Promise.all(
      input.map((file) =>
        this.storageService.createTemporaryFileUploadUrl(file),
      ),
    );
  }
}
