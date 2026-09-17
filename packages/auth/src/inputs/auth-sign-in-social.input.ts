import { Field, InputType } from "@nest-boot/graphql";
import { IsBoolean, IsOptional, IsString } from "class-validator";

/** Social or generic OAuth sign-in input. */
@InputType()
export class AuthSignInSocialInput {
  /** Configured provider identifier. */
  @IsString()
  @Field(() => String)
  provider!: string;

  /** URL returned after a successful provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** URL returned after a newly created user's provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  newUserCallbackURL?: string;

  /** URL returned after a failed provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  errorCallbackURL?: string;

  /** Additional OAuth scopes requested from the provider. */
  @IsOptional()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  scopes?: string[];

  /** Whether this flow may create a new user. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  requestSignUp?: boolean;

  /** Optional provider login hint. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  loginHint?: string;
}
