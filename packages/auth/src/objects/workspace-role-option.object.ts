import { Field, ObjectType } from "@nest-boot/graphql";

import { WorkspaceRole } from "../enums/workspace-role.enum.js";

/** Configured workspace role and its grant availability for the current principal. */
@ObjectType()
export class WorkspaceRoleOption {
  /** Configured role name. */
  @Field(() => WorkspaceRole)
  role!: WorkspaceRole;

  /** Whether the principal can assign this role, subject to target-specific checks. */
  @Field(() => Boolean)
  grantable!: boolean;
}
