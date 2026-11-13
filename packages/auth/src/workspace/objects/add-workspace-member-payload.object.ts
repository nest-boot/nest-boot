import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Added member identifier without restricted relations. */
@ObjectType()
export class AddWorkspaceMemberPayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
