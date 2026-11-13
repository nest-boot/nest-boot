import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Email and password sign-in input. */
@InputType()
export class AuthSignInInput {
  /** User email address. */
  @ZodField((z) => z.email().max(255))
  @Field(() => String)
  email!: string;

  /** Account password. */
  @ZodField((z) => z.string())
  @Field(() => String)
  password!: string;

  /** URL returned after successful authentication. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** Whether the created session should persist across browser restarts. */
  @ZodField((z) => z.boolean().optional())
  @Field(() => Boolean, { nullable: true })
  rememberMe?: boolean;
}
