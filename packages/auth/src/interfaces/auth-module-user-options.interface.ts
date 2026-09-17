import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";
import type { BuildUserAbilityCallback } from "../types/build-user-ability-callback.type.js";
import type { AuthModuleChangeEmailOptions } from "./auth-module-change-email-options.interface.js";
import type { AuthModuleDeleteUserOptions } from "./auth-module-delete-user-options.interface.js";

/** User lifecycle and authorization options owned by AuthModule. */
export interface AuthModuleUserOptions<Permission extends string = string> {
  /** Role assigned to users when none is supplied. Defaults to `user`. */
  defaultRole?: string;
  /** Roles classified as administrators. Defaults to `admin`. */
  adminRoles?: readonly string[];
  /** User permission catalog. Defaults to `DEFAULT_USER_PERMISSIONS`. */
  permissions?: readonly Permission[];
  /** Named user roles and their permissions. Defaults to `DEFAULT_USER_ROLES`. */
  roles?: AuthModuleRoles<NoInfer<Permission>>;
  /** Builds the user-scoped CASL ability from resolved permissions and the authenticated user. */
  buildAbility?: BuildUserAbilityCallback<Permission>;
  /** Email-change lifecycle configuration. */
  changeEmail?: AuthModuleChangeEmailOptions;
  /** User-deletion lifecycle configuration. */
  deleteUser?: AuthModuleDeleteUserOptions;
}
