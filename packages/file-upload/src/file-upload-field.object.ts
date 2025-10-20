import { Field, ObjectType } from "@nest-boot/graphql";

@ObjectType()
export class FileUploadField {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  value!: string;
}
