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

const catalogs = {
  user: new WeakMap<object, ReturnType<typeof resolveAuthCatalog>>(),
  workspace: new WeakMap<object, ReturnType<typeof resolveAuthCatalog>>(),
};

/** Resolves one immutable catalog per scope configuration, shared by startup, services and abilities. */
export function resolveAuthCatalog(
  options: AuthModuleOptions,
  scope: "user" | "workspace",
): {
  readonly permissions: readonly string[];
  readonly roles: AuthModuleRoles;
} {
  const defaults =
    scope === "user"
      ? { permissions: DEFAULT_USER_PERMISSIONS, roles: DEFAULT_USER_ROLES }
      : {
          permissions: DEFAULT_WORKSPACE_PERMISSIONS,
          roles: DEFAULT_WORKSPACE_ROLES,
        };
  const configured = options[scope];
  const key = configured ?? defaults.roles;
  const cached = catalogs[scope].get(key);
  if (cached) return cached;
  const builtInRoles: AuthModuleRoles = defaults.roles;
  const roleNames = new Set([
    ...Object.keys(builtInRoles),
    ...Object.keys(configured?.roles ?? {}),
  ]);
  const catalog = Object.freeze({
    permissions: Object.freeze([
      ...new Set([...defaults.permissions, ...(configured?.permissions ?? [])]),
    ]),
    roles: Object.freeze(
      Object.fromEntries(
        [...roleNames].map((role) => [
          role,
          Object.freeze([
            ...new Set([
              ...(Object.hasOwn(builtInRoles, role) ? builtInRoles[role] : []),
              ...(configured?.roles && Object.hasOwn(configured.roles, role)
                ? (configured.roles[role] ?? [])
                : []),
            ]),
          ]),
        ]),
      ),
    ),
  });
  catalogs[scope].set(key, catalog);
  return catalog;
}
