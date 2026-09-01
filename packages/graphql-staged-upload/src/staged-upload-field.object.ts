import { Field, ObjectType } from "@nest-boot/graphql";
import { type StagedUploadField as StagedUploadFieldResult } from "@nest-boot/staged-upload";

/** GraphQL object representing one required presigned POST form field. */
@ObjectType()
export class StagedUploadField implements StagedUploadFieldResult {
  /** Form field name. */
  @Field(() => String)
  name!: string;

  /** Form field value. */
  @Field(() => String)
  value!: string;
}
