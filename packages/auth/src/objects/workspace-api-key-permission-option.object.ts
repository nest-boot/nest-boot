import { Field, ObjectType } from "@nest-boot/graphql";

import { WorkspaceApiKeyPermission } from "../enums/workspace-api-key-permission.enum.js";

/** A workspace API-key permission and whether the caller may grant it. */
@ObjectType()
export class WorkspaceApiKeyPermissionOption {
  /** Permission from the complete workspace API-key catalog. */
  @Field(() => WorkspaceApiKeyPermission)
  permission!: WorkspaceApiKeyPermission;

  /** Includes configuration limits, user-identity requirements and the caller's grant ceiling. */
  @Field(() => Boolean)
  grantable!: boolean;
}
