import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Accepted invitation identifiers without private or workspace-scoped relations. */
@ObjectType()
export class AcceptInvitationPayload {
  /** Identifier of the accepted invitation. */
  @Field(() => ID)
  id!: string;

  /** Identifier of the resulting workspace membership. */
  @Field(() => ID)
  memberId!: string;

  /** Workspace to select in subsequent requests. */
  @Field(() => ID)
  workspaceId!: string;
}
