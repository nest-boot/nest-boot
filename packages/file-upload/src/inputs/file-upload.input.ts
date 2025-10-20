import { Field, InputType, Int } from "@nest-boot/graphql";

@InputType()
export class FileUploadInput {
  @Field(() => String)
  name!: string;

  @Field(() => Int)
  fileSize!: number;

  @Field(() => String)
  mimeType!: string;
}
