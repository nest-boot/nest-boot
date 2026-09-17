import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Fields an administrator can update directly. */
@InputType()
export class UpdateUserInput {
  /** Replacement email address. */
  @ZodField((z) => z.email().optional())
  @Field(() => String, { nullable: true })
  email?: string;

  /** Whether the replacement email is verified. */
  @ZodField((z) => z.boolean().optional())
  @Field(() => Boolean, { nullable: true })
  emailVerified?: boolean;

  /** Replacement display name. */
  @ZodField((z) => z.string().optional())
  @Field(() => String, { nullable: true })
  name?: string;

  /** Replacement avatar URL, or null to clear it. */
  @ZodField((z) => z.string().nullish())
  @Field(() => String, { nullable: true })
  image?: string | null;
}
