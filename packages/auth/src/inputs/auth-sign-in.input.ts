import { Field, InputType } from "@nest-boot/graphql";
import { IsBoolean, IsEmail, IsOptional, IsString } from "class-validator";

/** Email and password sign-in input. */
@InputType()
export class AuthSignInInput {
  /** User email address. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** Account password. */
  @IsString()
  @Field(() => String)
  password!: string;

  /** URL returned after successful authentication. */
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
