import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Current-user profile update input. */
@InputType()
export class AuthUpdateUserInput {
  /** New user display name. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  name?: string;

  /** New avatar URL, or `null` to remove the avatar. */
  @ZodField((z) => z.string().nullish())
  @Field(() => String, { nullable: true })
  image?: string | null;
}
