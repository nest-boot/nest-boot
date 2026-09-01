import { Args, Mutation, Resolver } from "@nest-boot/graphql";
import { StagedUploadService } from "@nest-boot/staged-upload";

import { StagedUploadInput } from "./inputs/staged-upload.input.js";
import { StagedUpload } from "./staged-upload.object.js";

/** GraphQL resolver for creating staged uploads. */
@Resolver(() => StagedUpload)
export class StagedUploadResolver {
  /** Creates a staged upload resolver.
   * @param stagedUploadService - Globally registered staged upload service
   */
  constructor(private readonly stagedUploadService: StagedUploadService) {}

  /**
   * Creates presigned POST data for the requested files.
   * @param input - File metadata to validate and stage
   * @returns Presigned upload URLs and form fields
   */
  @Mutation(() => [StagedUpload])
  async createStagedUploads(
    @Args({ type: () => [StagedUploadInput], name: "input" })
    input: StagedUploadInput[],
  ): Promise<StagedUpload[]> {
    return await this.stagedUploadService.create(input);
  }
}
