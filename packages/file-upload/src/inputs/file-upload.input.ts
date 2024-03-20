import { Field, InputType, Int } from "@nestjs/graphql";

@InputType()
export class FileUploadInput {
  @Field()
  name!: string;

  @Field(() => Int)
  fileSize!: number;

  @Field()
  mimeType!: string;
}
