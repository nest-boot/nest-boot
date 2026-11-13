import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Updated user identifier without restricted user relations. */
@ObjectType()
export class UpdateUserPayload {
  /** Identifier of the affected user. */
  @Field(() => ID)
  id!: string;
}
