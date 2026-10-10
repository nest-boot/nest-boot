import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Social or generic OAuth sign-in input. */
@InputType()
export class AuthSignInSocialInput {
  /** Configured provider identifier. */
  @ZodField((z) => z.string())
  @Field(() => String)
  provider!: string;

  /** URL returned after a successful provider callback. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** URL returned after a newly created user's provider callback. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  newUserCallbackURL?: string;

  /** URL returned after a failed provider callback. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  errorCallbackURL?: string;

  /** Additional OAuth scopes requested from the provider. */
  @ZodField((z) => z.array(z.string()).optional())
  @Field(() => [String], { nullable: true })
  scopes?: string[];

  /** Whether this flow may create a new user. */
  @ZodField((z) => z.boolean().optional())
  @Field(() => Boolean, { nullable: true })
  requestSignUp?: boolean;

  /** Optional provider login hint. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  loginHint?: string;
}
