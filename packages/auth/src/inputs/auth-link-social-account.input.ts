import { Field, InputType } from "@nest-boot/graphql";
import { IsOptional, IsString } from "class-validator";

/** Starts a social or OpenID Connect account-linking flow. */
@InputType()
export class AuthLinkSocialAccountInput {
  /** Configured provider identifier. */
  @IsString()
  @Field(() => String)
  provider!: string;

  /** URL returned to after a successful provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** URL returned to after a failed provider callback. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  errorCallbackURL?: string;

  /** Additional OAuth scopes requested from the provider. */
  @IsOptional()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  scopes?: string[];

  /** Optional provider login hint. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  loginHint?: string;
}
