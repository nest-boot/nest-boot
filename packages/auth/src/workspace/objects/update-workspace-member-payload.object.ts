import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Updated member identifier without restricted relations. */
@ObjectType()
export class UpdateWorkspaceMemberPayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
