import { Field, ID, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { MemberApiKeyPermission } from "../enums/member-api-key-permission.enum.js";

/**
 * Input for creating an API key.
 */
@InputType()
export class CreateMemberApiKeyInput {
  /** Owning member; omission uses the current member. */
  @ZodField((z) => z.string().min(1).optional())
  @Field(() => ID, { nullable: true })
  memberId?: string;

  /** API key display name. */
  @ZodField((z) => z.string().trim().min(1).max(255))
  @Field(() => String)
  name!: string;

  /** API key expiration time; omitted or null means no expiration. */
  @ZodField((z) => z.date().nullish())
  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  /** Plaintext prefix: 1–32 lowercase letters, digits, underscores, or hyphens, starting with a letter. Defaults to ws_ unless configured. */
  @ZodField((z) =>
    z
      .string()
      .min(1)
      .max(32)
      .regex(/^[a-z][a-z0-9_-]*$/u)
      .optional(),
  )
  @Field(() => String, { nullable: true })
  prefix?: string;

  /** API key permissions; null inherits all owner permissions. */
  @ZodField((z) => z.array(z.string()).nullish())
  @Field(() => [MemberApiKeyPermission], { nullable: true })
  permissions?: MemberApiKeyPermission[] | null;
}
