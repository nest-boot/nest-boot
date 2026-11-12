import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Role-updated member identifier without restricted relations. */
@ObjectType()
export class SetWorkspaceMemberRolesPayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
