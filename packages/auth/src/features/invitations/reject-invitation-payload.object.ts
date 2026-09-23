import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Rejected invitation identifier without restricted relations. */
@ObjectType()
export class RejectInvitationPayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
