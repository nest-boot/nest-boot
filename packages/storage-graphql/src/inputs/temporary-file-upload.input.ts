import { Field, InputType, Int } from "@nest-boot/graphql";
import { type StorageTemporaryFileUploadRequest } from "@nest-boot/storage";

/** GraphQL input for requesting a temporary file upload URL. */
@InputType()
export class TemporaryFileUploadInput implements StorageTemporaryFileUploadRequest {
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
