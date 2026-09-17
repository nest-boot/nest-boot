import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { UserApiKeyPermission } from "../enums/user-api-key-permission.enum.js";

/**
 * Input for creating an API key.
 */
@InputType()
export class CreateUserApiKeyInput {
  /** API key display name. */
  @ZodField((z) => z.string().trim().min(1).max(255))
  @Field(() => String)
  name!: string;

  /** API key expiration time; omitted or null means no expiration. */
  @ZodField((z) => z.date().nullish())
  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  /** Plaintext prefix: 1–32 lowercase letters or digits, starting with a letter. Defaults to sk. */
  @ZodField((z) =>
    z
      .string()
      .min(1)
      .max(32)
      .regex(/^[a-z][a-z0-9]*$/u)
      .optional(),
  )
  @Field(() => String, { nullable: true })
  prefix?: string;

  /** API key permissions; null creates a key without permissions. */
  @ZodField((z) => z.array(z.string()).nullish())
  @Field(() => [UserApiKeyPermission], { nullable: true })
  permissions?: UserApiKeyPermission[] | null;
}
