import { Field, ObjectType } from "@nest-boot/graphql";

import { UserPermission } from "../enums/user-permission.enum.js";

/** Configured user permission and its grant availability for the current principal. */
@ObjectType()
export class UserPermissionOption {
  /** Configured permission value. */
  @Field(() => UserPermission)
  permission!: UserPermission;

  /** Whether this permission is within the principal's grant ceiling, not target authorization. */
  @Field(() => Boolean)
  grantable!: boolean;
}
