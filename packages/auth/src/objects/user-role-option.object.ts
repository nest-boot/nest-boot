import { Field, ObjectType } from "@nest-boot/graphql";

import { UserRole } from "../enums/user-role.enum.js";

/** Configured user role and its grant availability for the current principal. */
@ObjectType()
export class UserRoleOption {
  /** Configured role name. */
  @Field(() => UserRole)
  role!: UserRole;

  /** Whether the role is within the current principal's grant ceiling, not target authorization. */
  @Field(() => Boolean)
  grantable!: boolean;
}
