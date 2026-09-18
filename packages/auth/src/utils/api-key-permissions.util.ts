import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { resolveAuthCatalog } from "./resolve-auth-catalog.util.js";

/** Returns the owner's complete enum catalog and the subset configurable on API keys. */
export function resolveApiKeyPermissionCatalog(
  options: AuthModuleOptions,
  scope: "user" | "workspace",
): {
  permissions: string[];
  allowed: string[];
} {
  const users = resolveAuthCatalog(options, "user").permissions;
  const workspaces = resolveAuthCatalog(options, "workspace").permissions;
  const permissions = [
    ...new Set(scope === "user" ? [...users, ...workspaces] : workspaces),
  ];
  const allowlist = new Set(options.apiKey?.allowedPermissions ?? permissions);
  return {
    permissions,
    allowed: permissions.filter(
      (permission) =>
        allowlist.has(permission) &&
        (scope !== "workspace" || permission !== "invitation:create"),
    ),
  };
}
