import { Field, ObjectType } from "@nest-boot/graphql";

import { FileUploadField } from "./file-upload-field.object";

@ObjectType()
export class FileUpload {
  @Field(() => [FileUploadField])
  fields!: FileUploadField[];

  @Field(() => String)
  url!: string;
}
