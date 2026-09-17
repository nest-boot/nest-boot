import { Field, InputType } from "@nest-boot/graphql";
import { IsBoolean, IsEmail, IsOptional, IsString } from "class-validator";

/** Email and password registration input. */
@InputType()
export class AuthSignUpInput {
  /** User display name. */
  @IsString()
  @Field(() => String)
  name!: string;

  /** User email address. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** Initial account password. */
  @IsString()
  @Field(() => String)
  password!: string;

  /** Optional user avatar URL. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  image?: string;

  /** URL used after email verification completes. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** Whether the created session should persist across browser restarts. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  rememberMe?: boolean;
}
