import { Field, ObjectType } from "@nest-boot/graphql";

import { MemberApiKeyPermission } from "../enums/member-api-key-permission.enum.js";

/** A member API-key permission and whether the caller may grant it. */
@ObjectType()
export class MemberApiKeyPermissionOption {
  /** Permission from the complete member API-key catalog. */
  @Field(() => MemberApiKeyPermission)
  permission!: MemberApiKeyPermission;

  /** Includes configuration limits, user-identity requirements and the caller's grant ceiling. */
  @Field(() => Boolean)
  grantable!: boolean;

  /** Whether configuration selects this permission by default, independently of grantability. */
  @Field(() => Boolean)
  default!: boolean;
}
