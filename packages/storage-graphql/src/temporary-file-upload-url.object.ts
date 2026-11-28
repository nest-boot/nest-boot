import { Field, ObjectType } from "@nest-boot/graphql";
import { type StorageTemporaryFileUploadUrl } from "@nest-boot/storage";

import { TemporaryFileUploadField } from "./temporary-file-upload-field.object.js";

/** GraphQL object representing a presigned temporary file upload target and its resource URL. */
@ObjectType()
export class TemporaryFileUploadUrl implements StorageTemporaryFileUploadUrl {
  /** Presigned POST destination URL. */
  @Field(() => String)
  url!: string;

  /** Temporary presigned GET URL for previewing and uploading the staged file into permanent storage. */
  @Field(() => String)
  resourceUrl!: string;

  /** Form fields required for the presigned POST upload. */
  @Field(() => [TemporaryFileUploadField])
  fields!: TemporaryFileUploadField[];
}
