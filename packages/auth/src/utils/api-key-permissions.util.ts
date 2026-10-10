import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { normalizeAuthPermissions } from "./auth-role.util.js";
import { assertPermissionCeiling } from "./permission-grants.util.js";
import { resolveAuthCatalog } from "./resolve-auth-catalog.util.js";

const catalogs = new WeakMap<
  AuthModuleOptions,
  Partial<
    Record<"user" | "member", ReturnType<typeof resolveApiKeyPermissionCatalog>>
  >
>();

/**
 * Returns the owner's complete enum catalog and the subset configurable on API keys.
 * @param options - Authentication module configuration.
 * @param scope - Authorization scope to apply.
 * @returns Permission names available to keys in the requested scope.
 */
export function resolveApiKeyPermissionCatalog(
  options: AuthModuleOptions,
  scope: "user" | "member",
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

/**
 * Applies scope defaults, validates catalog values, and enforces the configured key ceiling.
 * @param options - Authentication module configuration.
 * @param scope - Authorization scope to apply.
 * @param requested - Requested grants to validate.
 * @returns Validated API key permission restriction list.
 * @internal
 */
export function normalizeApiKeyPermissions(
  options: AuthModuleOptions,
  scope: "user" | "member",
  requested: readonly string[] | null | undefined,
): string[] {
  const { permissions, allowed, defaults } = resolveApiKeyPermissionCatalog(
    options,
    scope,
  );
  const normalized = normalizeAuthPermissions(
    requested === undefined ? defaults : (requested ?? []),
    permissions,
    scope === "user" ? "User API key" : "Member API key",
  );
  assertPermissionCeiling(
    normalized,
    allowed,
    "API key permissions exceed configured allowedPermissions",
  );
  return normalized;
}
