import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";
import type { PermissionName } from "../types/permission-name.type.js";
import type { AuthModuleChangeEmailOptions } from "./auth-module-change-email-options.interface.js";
import type { AuthModuleDeleteUserOptions } from "./auth-module-delete-user-options.interface.js";

/** User lifecycle and authorization options owned by AuthModule. */
export interface AuthModuleUserOptions<
  Permission extends string = string,
  Role extends string = string,
> {
  /** Role assigned to users when none is supplied. Defaults to `user`. */
  defaultRole?: NoInfer<Role>;
  /** Roles classified as administrators. Defaults to `admin`. */
  adminRoles?: readonly NoInfer<Role>[];
  /** Additional user permission names, merged with `DEFAULT_USER_PERMISSIONS`. */
  permissions?: readonly (Permission &
    (string extends Permission ? unknown : PermissionName<Permission>))[];
  /** Additional roles and grants; same-name roles extend `DEFAULT_USER_ROLES`. */
  roles?: Partial<AuthModuleRoles<NoInfer<Permission>, Role>>;
  /** Email-change lifecycle configuration. */
  changeEmail?: AuthModuleChangeEmailOptions;
  /** User-deletion lifecycle configuration. */
  deleteUser?: AuthModuleDeleteUserOptions;
}
