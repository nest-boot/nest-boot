import { Field, InputType } from "@nest-boot/graphql";
import { IsEmail, IsOptional, IsString } from "class-validator";

/** Password-reset request input. */
@InputType()
export class AuthRequestPasswordResetInput {
  /** Email address that owns the credential password. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** URL that receives the password-reset token. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  redirectTo?: string;
}
