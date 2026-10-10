import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Registration result without user relations that require an authenticated session. */
@ObjectType()
export class SignUpPayload {
  /** Identifier of the registered user. */
  @Field(() => ID)
  id!: string;

  /** Session token, or null when registration requires email verification. */
  @Field(() => String, { nullable: true })
  token!: string | null;
}
