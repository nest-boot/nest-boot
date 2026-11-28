import { Field, ObjectType } from "@nest-boot/graphql";
import { type StorageTemporaryFileUploadField } from "@nest-boot/storage";

/** GraphQL object representing one required presigned POST form field. */
@ObjectType()
export class TemporaryFileUploadField implements StorageTemporaryFileUploadField {
  /** Form field name. */
  @Field(() => String)
  name!: string;

  /** Form field value. */
  @Field(() => String)
  value!: string;
}
