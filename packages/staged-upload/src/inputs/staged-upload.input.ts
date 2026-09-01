import { Field, InputType, Int } from "@nest-boot/graphql";

/** GraphQL input for requesting a staged upload. */
@InputType()
export class StagedUploadInput {
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
