import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { resolveAuthCatalog } from "./resolve-auth-catalog.util.js";

const catalogs = new WeakMap<
  AuthModuleOptions,
  Partial<
    Record<
      "user" | "workspace",
      ReturnType<typeof resolveApiKeyPermissionCatalog>
    >
  >
>();

/** Returns the owner's complete enum catalog and the subset configurable on API keys. */
export function resolveApiKeyPermissionCatalog(
  options: AuthModuleOptions,
  scope: "user" | "workspace",
): {
  readonly permissions: readonly string[];
  readonly allowed: readonly string[];
  readonly defaults: readonly string[];
} {
  const scopes = catalogs.get(options) ?? {};
  const cached = scopes[scope];
  if (cached) return cached;
  const users = resolveAuthCatalog(options, "user").permissions;
  const workspaces = resolveAuthCatalog(options, "workspace").permissions;
  const permissions = [
    ...new Set(scope === "user" ? [...users, ...workspaces] : workspaces),
  ];
  const allowlist = new Set(
    options.apiKey?.[scope]?.allowedPermissions ?? permissions,
  );
  const catalog = Object.freeze({
    permissions: Object.freeze(permissions),
    defaults: Object.freeze([
      ...(options.apiKey?.[scope]?.defaultPermissions ?? []),
    ]),
    allowed: Object.freeze(
      permissions.filter((permission) => allowlist.has(permission)),
    ),
  });
  scopes[scope] = catalog;
  catalogs.set(options, scopes);
  return catalog;
}
