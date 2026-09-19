import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Starts a social or OpenID Connect account-linking flow. */
@InputType()
export class AuthLinkSocialAccountInput {
  /** Configured provider identifier. */
  @ZodField((z) => z.string())
  @Field(() => String)
  provider!: string;

  /** URL returned to after a successful provider callback. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** URL returned to after a failed provider callback. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  errorCallbackURL?: string;

  /** Additional OAuth scopes requested from the provider. */
  @ZodField((z) => z.array(z.string()).optional())
  @Field(() => [String], { nullable: true })
  scopes?: string[];

  /** Optional provider login hint. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  loginHint?: string;
}
