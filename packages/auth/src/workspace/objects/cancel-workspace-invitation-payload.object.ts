import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Canceled invitation identifier without restricted relations. */
@ObjectType()
export class CancelWorkspaceInvitationPayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
