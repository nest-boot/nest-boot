import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Password-reset request input. */
@InputType()
export class AuthRequestPasswordResetInput {
  /** Email address that owns the credential password. */
  @ZodField((z) => z.email())
  @Field(() => String)
  email!: string;

  /** URL that receives the password-reset token. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  redirectTo?: string;
}
