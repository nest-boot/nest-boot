import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Created user identifier without restricted user relations. */
@ObjectType()
export class CreateUserPayload {
  /** Identifier of the affected user. */
  @Field(() => ID)
  id!: string;
}
