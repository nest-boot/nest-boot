import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { SystemAccountPermission } from "../enums/system-account-permission.enum.js";
/** Administrator changes to an independent system identity. */
@InputType()
export class UpdateSystemAccountInput {
  /** New display name. */
  @ZodField((z) => z.string().trim().min(1).max(255).optional())
  @Field(() => String, { nullable: true })
  name?: string;
  /** Whether all credentials of the account can authenticate. */
  @ZodField((z) => z.boolean().optional())
  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;
  /** Updated explicit grant ceiling; null removes all grants. */
  @ZodField((z) => z.array(z.string()).nullish())
  @Field(() => [SystemAccountPermission], { nullable: true })
  permissions?: SystemAccountPermission[] | null;
}
