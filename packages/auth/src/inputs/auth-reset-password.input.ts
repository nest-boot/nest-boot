import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Password reset input. */
@InputType()
export class AuthResetPasswordInput {
  /** Replacement password. */
  @ZodField((z) => z.string())
  @Field(() => String)
  newPassword!: string;

  /** Token issued by the password-reset flow. */
  @ZodField((z) => z.string())
  @Field(() => String)
  token!: string;
}
