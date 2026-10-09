import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { MemberApiKeyPermission } from "../enums/member-api-key-permission.enum.js";

/**
 * Input for updating an API key.
 */
@InputType()
export class UpdateMemberApiKeyInput {
  /** New API key display name. */
  @ZodField((z) => z.string().trim().min(1).max(255).optional())
  @Field(() => String, { nullable: true })
  name?: string;

  /** Whether the API key can authenticate requests. */
  @ZodField((z) => z.boolean().optional())
  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  /** API key expiration time; null removes the expiration. */
  @ZodField((z) => z.date().nullish())
  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  /** API key permissions. */
  @ZodField((z) => z.array(z.string()).nullish())
  @Field(() => [MemberApiKeyPermission], { nullable: true })
  permissions?: MemberApiKeyPermission[] | null;
}
