import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Banned user identifier without restricted user relations. */
@ObjectType()
export class BanUserPayload {
  /** Identifier of the affected user. */
  @Field(() => ID)
  id!: string;
}
