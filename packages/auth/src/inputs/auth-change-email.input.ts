import { Field, InputType } from "@nest-boot/graphql";
import { IsEmail, IsOptional, IsString } from "class-validator";

/** Current-user email change input. */
@InputType()
export class AuthChangeEmailInput {
  /** New email address. */
  @IsEmail()
  @Field(() => String)
  newEmail!: string;

  /** URL used after email verification completes. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;
}
