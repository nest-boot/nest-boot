import { Field, InputType, Int } from "@nest-boot/graphql";

/** GraphQL input type for requesting a file upload. */
@InputType()
export class FileUploadInput {
  /** Original file name including extension. */
  @Field(() => String)
  name!: string;

  /** File size in bytes. */
  @Field(() => Int)
  fileSize!: number;

  /** MIME type of the file (e.g. "image/png"). */
  @Field(() => String)
  mimeType!: string;
}
