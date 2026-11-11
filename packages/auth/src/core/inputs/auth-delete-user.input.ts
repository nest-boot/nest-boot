import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Current-user deletion input. */
@InputType()
export class AuthDeleteUserInput {
  /** URL used after deletion verification completes. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** Current password when additional authorization is required. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  password?: string;

  /** Account-deletion verification token. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  token?: string;
}
