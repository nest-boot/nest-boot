import { Field, ObjectType } from "@nest-boot/graphql";

/** GraphQL object type representing a single form field in a presigned upload. */
@ObjectType()
export class FileUploadField {
  /** Form field name. */
  @Field(() => String)
  name!: string;

  /** Form field value. */
  @Field(() => String)
  value!: string;
}
