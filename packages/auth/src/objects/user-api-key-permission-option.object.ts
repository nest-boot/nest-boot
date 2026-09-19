import { Field, ObjectType } from "@nest-boot/graphql";

import { UserApiKeyPermission } from "../enums/user-api-key-permission.enum.js";

/** A user API-key permission and whether the caller may grant it. */
@ObjectType()
export class UserApiKeyPermissionOption {
  /** Permission from the complete API-key catalog. */
  @Field(() => UserApiKeyPermission)
  permission!: UserApiKeyPermission;

  /** Includes configuration limits and the caller's grant ceiling. */
  @Field(() => Boolean)
  grantable!: boolean;
}
