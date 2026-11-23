import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { urlIdentifierSchema } from "../../common/utils/url-identifier.util.js";

/** Email and password registration input. */
@InputType()
export class AuthSignUpInput {
  /** User display name. */
  @ZodField((z) => z.string().trim().min(1).max(255))
  @Field(() => String)
  name!: string;

  /** Optional account handle; the backend generates one when omitted. */
  @ZodField(() => urlIdentifierSchema.optional())
  @Field(() => String, { nullable: true })
  username?: string;

  /** User email address. */
  @ZodField((z) => z.email().max(255))
  @Field(() => String)
  email!: string;

  /** Initial account password. */
  @ZodField((z) => z.string())
  @Field(() => String)
  password!: string;

  /** Optional user avatar URL. */
  @ZodField((z) => z.string().max(255).optional())
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
