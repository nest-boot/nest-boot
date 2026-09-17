import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Role-updated user identifier without restricted user relations. */
@ObjectType()
export class SetUserRolesPayload {
  /** Identifier of the affected user. */
  @Field(() => ID)
  id!: string;
}
