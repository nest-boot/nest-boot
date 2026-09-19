import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Result of leaving a workspace without relations to the removed member. */
@ObjectType()
export class LeaveWorkspacePayload {
  /** Identifier of the removed member, not the workspace. */
  @Field(() => ID)
  memberId!: string;
}
