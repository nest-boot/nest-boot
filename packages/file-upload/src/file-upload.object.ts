import { Field, ObjectType } from "@nest-boot/graphql";

import { FileUploadField } from "./file-upload-field.object";

/** GraphQL object type representing a presigned file upload response. */
@ObjectType()
export class FileUpload {
  /** Form fields required for the presigned POST upload. */
  @Field(() => [FileUploadField])
  fields!: FileUploadField[];

  /** The presigned upload URL. */
  @Field(() => String)
  url!: string;
}
