import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Created invitation identifier without restricted relations. */
@ObjectType()
export class CreateWorkspaceInvitationPayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
