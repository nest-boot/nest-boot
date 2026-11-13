import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Current-user email change input. */
@InputType()
export class AuthChangeEmailInput {
  /** New email address. */
  @ZodField((z) => z.email().max(255))
  @Field(() => String)
  newEmail!: string;

  /** URL used after email verification completes. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  callbackURL?: string;
}
