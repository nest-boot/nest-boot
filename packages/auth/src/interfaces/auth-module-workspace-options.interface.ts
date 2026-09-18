import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";
import type { AuthSendInvitationEmail } from "../types/auth-send-invitation-email.type.js";
import type { BuildWorkspaceAbilityCallback } from "../types/build-workspace-ability-callback.type.js";
import type { PermissionName } from "../types/permission-name.type.js";

/** Workspace lifecycle options owned by AuthModule. */
export interface AuthModuleWorkspaceOptions<
  Permission extends string = string,
  Role extends string = string,
> {
  /** Role assigned to members and invitations when none is supplied. Defaults to `member`. */
  defaultRole?: NoInfer<Role>;
  /** Role assigned to a workspace creator. Defaults to `owner`. */
  creatorRole?: NoInfer<Role>;
  /** Additional workspace permission names, merged with `DEFAULT_WORKSPACE_PERMISSIONS`. */
  permissions?: readonly (Permission &
    (string extends Permission ? unknown : PermissionName<Permission>))[];
  /** Additional roles and grants; same-name roles extend `DEFAULT_WORKSPACE_ROLES`. */
  roles?: Partial<AuthModuleRoles<NoInfer<Permission>, Role>>;
  /** Synchronously adds permission-bound business grants or restrictions; auth builds the final ability. */
  buildAbility?: BuildWorkspaceAbilityCallback<Permission>;
  /** Sends the invitation link through an application-defined delivery flow. */
  sendInvitationEmail?: AuthSendInvitationEmail;
}
