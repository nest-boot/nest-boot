import { assertPermissionCeiling } from "../../common/utils/permission-grants.util.js";
import { resolveAuthCatalog } from "../../common/utils/resolve-auth-catalog.util.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { normalizeAuthPermissions } from "../../core/utils/auth-role.util.js";
import { DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS } from "../constants/system-account.constants.js";

const catalogs = new WeakMap<
  AuthModuleOptions,
  Partial<
    Record<
      "user" | "member" | "systemAccount",
      ReturnType<typeof resolveApiKeyPermissionCatalog>
    >
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
  scope: "user" | "member" | "systemAccount",
): {
  readonly permissions: readonly string[];
  readonly allowed: readonly string[];
  readonly defaults: readonly string[];
} {
  const scopes = catalogs.get(options) ?? {};
  const cached = scopes[scope];
  if (cached) {
    return cached;
  }
  const users = resolveAuthCatalog(options, "user").permissions;
  const workspaces = resolveAuthCatalog(options, "workspace").permissions;
  const permissions = [
    ...new Set(
      scope === "systemAccount"
        ? DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS
        : scope === "user"
          ? [...users, ...workspaces]
          : workspaces,
    ),
  ];
  const configured =
    options.apiKey?.[
      scope === "member"
        ? "workspace"
        : scope === "systemAccount"
          ? "system"
          : scope
    ];
  const allowlist = new Set(configured?.allowedPermissions ?? permissions);
  const catalog = Object.freeze({
    permissions: Object.freeze(permissions),
    defaults: Object.freeze([...(configured?.defaultPermissions ?? [])]),
    allowed: Object.freeze(
      permissions.filter(
        (permission) =>
          allowlist.has(permission) &&
          (scope !== "systemAccount" ||
            options.workspace?.enabled === true ||
            !permission.startsWith("workspace:")),
      ),
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
  scope: "user" | "member" | "systemAccount",
  requested: readonly string[] | null | undefined,
): string[] {
  const { permissions, allowed, defaults } = resolveApiKeyPermissionCatalog(
    options,
    scope,
  );
  const normalized = normalizeAuthPermissions(
    requested === undefined ? defaults : (requested ?? []),
    permissions,
    scope === "user"
      ? "User API key"
      : scope === "member"
        ? "Member API key"
        : "System account API key",
  );
  assertPermissionCeiling(
    normalized,
    allowed,
    "API key permissions exceed configured allowedPermissions",
  );
  return normalized;
}
