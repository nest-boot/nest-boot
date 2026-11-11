import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Permission-updated member identifier without restricted relations. */
@ObjectType()
export class SetMemberPermissionsPayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
