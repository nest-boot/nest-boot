import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

import { SystemAccountPermission } from "../enums/system-account-permission.enum.js";
/** Administrator input for creating a system identity. */
@InputType()
export class CreateSystemAccountInput {
  /** Integration or system display name. */
  @ZodField((z) => z.string().trim().min(1).max(255))
  @Field(() => String)
  name!: string;
  /** Explicit platform grant ceiling; omitted grants no operations. */
  @ZodField((z) => z.array(z.string()).nullish())
  @Field(() => [SystemAccountPermission], { nullable: true })
  permissions?: SystemAccountPermission[] | null;
}
