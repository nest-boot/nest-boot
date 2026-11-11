import { Field, ObjectType } from "@nest-boot/graphql";

import { WorkspacePermission } from "../enums/workspace-permission.enum.js";

/** Configured workspace permission and its grant availability for the current principal. */
@ObjectType()
export class WorkspacePermissionOption {
  /** Configured permission value. */
  @Field(() => WorkspacePermission)
  permission!: WorkspacePermission;

  /** Whether the principal can assign this permission, subject to target-specific checks. */
  @Field(() => Boolean)
  grantable!: boolean;
}
