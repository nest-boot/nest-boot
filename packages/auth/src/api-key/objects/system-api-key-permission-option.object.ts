import { Field, ObjectType } from "@nest-boot/graphql";

import { SystemApiKeyPermission } from "../enums/system-api-key-permission.enum.js";

/** Platform grant choice bounded by the administrator and target account. */
@ObjectType()
export class SystemApiKeyPermissionOption {
  /** Stored platform permission represented by this option. */
  @Field(() => SystemApiKeyPermission)
  permission!: SystemApiKeyPermission;
  /** Whether the administrator may grant this permission. */
  @Field(() => Boolean)
  grantable!: boolean;
  /** Whether a newly created key selects this permission by default. */
  @Field(() => Boolean)
  default!: boolean;
}
