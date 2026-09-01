import { Field, ObjectType } from "@nest-boot/graphql";
import { type StagedUploadResult } from "@nest-boot/staged-upload";

import { StagedUploadField } from "./staged-upload-field.object.js";

/** GraphQL object representing a presigned staged upload. */
@ObjectType()
export class StagedUpload implements StagedUploadResult {
  /** Form fields required for the presigned POST upload. */
  @Field(() => [StagedUploadField])
  fields!: StagedUploadField[];

  /** Presigned POST destination URL. */
  @Field(() => String)
  url!: string;
}
