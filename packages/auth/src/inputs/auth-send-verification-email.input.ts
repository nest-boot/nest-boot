import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Email-verification request input. */
@InputType()
export class AuthSendVerificationEmailInput {
  /** Email address to verify. */
  @ZodField((z) => z.email().max(255))
  @Field(() => String)
  email!: string;

  /** URL used after email verification completes. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  callbackURL?: string;
}
