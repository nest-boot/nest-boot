import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class FileUploadField {
  @Field()
  name!: string;

  @Field()
  value!: string;
}
