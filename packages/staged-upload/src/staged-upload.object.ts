import { Field, ObjectType } from "@nest-boot/graphql";

import { StagedUploadField } from "./staged-upload-field.object.js";

/** GraphQL object representing a presigned staged upload. */
@ObjectType()
export class StagedUpload {
  /** Form fields required for the presigned POST upload. */
  @Field(() => [StagedUploadField])
  fields!: StagedUploadField[];

  /** The presigned upload URL. */
  @Field(() => String)
  url!: string;
}
