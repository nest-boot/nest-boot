import { Field, ObjectType } from "@nest-boot/graphql";

/** Password-reset request result. */
@ObjectType()
export class AuthRequestPasswordResetResultType {
  /** Whether the request was accepted. */
  @Field(() => Boolean)
  status!: boolean;

  /** Enumeration-safe result message. */
  @Field(() => String)
  message!: string;
}
