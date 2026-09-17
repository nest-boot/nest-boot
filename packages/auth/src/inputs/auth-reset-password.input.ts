import { Field, InputType } from "@nest-boot/graphql";
import { IsString } from "class-validator";

/** Password reset input. */
@InputType()
export class AuthResetPasswordInput {
  /** Replacement password. */
  @IsString()
  @Field(() => String)
  newPassword!: string;

  /** Token issued by the password-reset flow. */
  @IsString()
  @Field(() => String)
  token!: string;
}
