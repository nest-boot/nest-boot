import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Permission-updated user identifier without restricted user relations. */
@ObjectType()
export class SetUserPermissionsPayload {
  /** Identifier of the affected user. */
  @Field(() => ID)
  id!: string;
}
