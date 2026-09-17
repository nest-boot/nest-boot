import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Email and password registration input. */
@InputType()
export class AuthSignUpInput {
  /** User display name. */
  @ZodField((z) => z.string())
  @Field(() => String)
  name!: string;

  /** User email address. */
  @ZodField((z) => z.email())
  @Field(() => String)
  email!: string;

  /** Initial account password. */
  @ZodField((z) => z.string())
  @Field(() => String)
  password!: string;

  /** Optional user avatar URL. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  image?: string;

  /** URL used after email verification completes. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** Whether the created session should persist across browser restarts. */
  @ZodField((z) => z.boolean().optional())
  @Field(() => Boolean, { nullable: true })
  rememberMe?: boolean;
}
