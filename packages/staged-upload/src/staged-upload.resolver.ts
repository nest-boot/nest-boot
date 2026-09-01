import { Args, Mutation, Resolver } from "@nest-boot/graphql";

import { StagedUploadInput } from "./inputs/staged-upload.input.js";
import { StagedUpload } from "./staged-upload.object.js";
import { StagedUploadService } from "./staged-upload.service.js";

@Resolver(() => StagedUpload)
export class StagedUploadResolver {
  constructor(private readonly stagedUploadService: StagedUploadService) {}

  @Mutation(() => [StagedUpload])
  async createStagedUploads(
    @Args({ type: () => [StagedUploadInput], name: "input" })
    input: StagedUploadInput[],
  ): Promise<StagedUpload[]> {
    return await this.stagedUploadService.create(input);
  }
}
