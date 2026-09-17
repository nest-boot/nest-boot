import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Unbanned user identifier without restricted user relations. */
@ObjectType()
export class UnbanUserPayload {
  /** Identifier of the affected user. */
  @Field(() => ID)
  id!: string;
}
