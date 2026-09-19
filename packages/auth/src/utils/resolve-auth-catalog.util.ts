import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "../user.constants.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "../workspace.constants.js";

/** Extends built-in catalogs and role grants without mutating caller configuration. */
export function resolveAuthCatalog(
  options: AuthModuleOptions,
  scope: "user" | "workspace",
): {
  permissions: string[];
  roles: AuthModuleRoles;
} {
  const defaults =
    scope === "user"
      ? { permissions: DEFAULT_USER_PERMISSIONS, roles: DEFAULT_USER_ROLES }
      : {
          permissions: DEFAULT_WORKSPACE_PERMISSIONS,
          roles: DEFAULT_WORKSPACE_ROLES,
        };
  const configured = options[scope];
  const builtInRoles: AuthModuleRoles = defaults.roles;
  const roleNames = new Set([
    ...Object.keys(builtInRoles),
    ...Object.keys(configured?.roles ?? {}),
  ]);
  return {
    permissions: [
      ...new Set([...defaults.permissions, ...(configured?.permissions ?? [])]),
    ],
    roles: Object.fromEntries(
      [...roleNames].map((role) => [
        role,
        [
          ...new Set([
            ...(Object.hasOwn(builtInRoles, role) ? builtInRoles[role] : []),
            ...(configured?.roles && Object.hasOwn(configured.roles, role)
              ? (configured.roles[role] ?? [])
              : []),
          ]),
        ],
      ]),
    ),
  };
}
