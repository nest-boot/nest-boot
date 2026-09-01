import { Field, InputType, Int } from "@nest-boot/graphql";
import { type StagedUploadRequest } from "@nest-boot/staged-upload";

/** GraphQL input for requesting a staged upload. */
@InputType()
export class StagedUploadInput implements StagedUploadRequest {
  /** Original file name including extension. */
  @Field(() => String)
  name!: string;

  /** File size in bytes. */
  @Field(() => Int)
  fileSize!: number;

  /** MIME type of the file. */
  @Field(() => String)
  mimeType!: string;
}
