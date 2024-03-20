import { Field, ObjectType } from "@nestjs/graphql";

import { FileUploadField } from "./file-upload-field.object";

@ObjectType()
export class FileUpload {
  @Field(() => [FileUploadField])
  fields!: FileUploadField[];

  @Field()
  url!: string;
}
