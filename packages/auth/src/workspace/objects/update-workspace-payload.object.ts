import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Updated workspace identifier without restricted relations. */
@ObjectType()
export class UpdateWorkspacePayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
