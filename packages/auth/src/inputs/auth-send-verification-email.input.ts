import { Field, InputType } from "@nest-boot/graphql";
import { IsEmail, IsOptional, IsString } from "class-validator";

/** Email-verification request input. */
@InputType()
export class AuthSendVerificationEmailInput {
  /** Email address to verify. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** URL used after email verification completes. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;
}
