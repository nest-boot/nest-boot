import { Field, ObjectType } from "@nest-boot/graphql";

/** GraphQL object representing one required presigned POST form field. */
@ObjectType()
export class StagedUploadField {
  /** Form field name. */
  @Field(() => String)
  name!: string;

  /** Form field value. */
  @Field(() => String)
  value!: string;
}
