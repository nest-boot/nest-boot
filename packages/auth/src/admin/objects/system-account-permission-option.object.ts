import { Field, ObjectType } from "@nest-boot/graphql";

import { SystemAccountPermission } from "../enums/system-account-permission.enum.js";

/** Platform grant choice bounded by the administrator and target account. */
@ObjectType()
export class SystemAccountPermissionOption {
  /** Stored platform permission represented by this option. */
  @Field(() => SystemAccountPermission)
  permission!: SystemAccountPermission;
  /** Whether the administrator may grant this permission. */
  @Field(() => Boolean)
  grantable!: boolean;
  /** Whether a newly created key selects this permission by default. */
  @Field(() => Boolean)
  default!: boolean;
}
