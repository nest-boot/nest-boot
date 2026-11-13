import { Field, ID, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { SystemApiKeyPermission } from "../enums/system-api-key-permission.enum.js";

/**
 * Input for creating an API key.
 */
@InputType()
export class CreateSystemApiKeyInput {
  /** Existing system account; omission creates one atomically with the key. */
  @ZodField((z) => z.string().min(1).nullish())
  @Field(() => ID, { nullable: true })
  systemAccountId?: string | null;

  /** API key display name. */
  @ZodField((z) => z.string().trim().min(1).max(255))
  @Field(() => String)
  name!: string;

  /** API key expiration time; omitted or null means no expiration. */
  @ZodField((z) => z.date().nullish())
  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  /** Plaintext prefix: 1–32 lowercase letters, digits, underscores, or hyphens, starting with a letter. Defaults to sys_ unless configured. */
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

  /** API key permissions; null grants no operations. */
  @ZodField((z) => z.array(z.string()).nullish())
  @Field(() => [SystemApiKeyPermission], { nullable: true })
  permissions?: SystemApiKeyPermission[] | null;
}
