import { DEFAULT_USER_ROLE } from "../../core/constants/user.constants.js";
import type { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { resolveAuthPermissions } from "../../core/utils/auth-role.util.js";
import { isAuthPermissionEnabled } from "../../core/utils/resolve-auth-features.util.js";
import { DEFAULT_WORKSPACE_ROLE } from "../../workspace/constants/workspace.constants.js";
import type { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { resolveAuthCatalog } from "./resolve-auth-catalog.util.js";

/**
 * Resolves an owner's grants independently of the requesting credential.
 * @param options - Authentication module configuration.
 * @param user - The user whose account is being accessed.
 * @returns Effective permissions from the user's roles and direct grants.
 * @internal
 */
export function resolveUserPermissions(
  options: AuthModuleOptions,
  user: User,
): string[] {
  return resolveAuthPermissions(
    user.roles ?? [options.user?.defaultRole ?? DEFAULT_USER_ROLE],
    user.permissions ?? [],
    resolveAuthCatalog(options, "user").roles,
  ).filter((permission) =>
    isAuthPermissionEnabled(options, "user", permission),
  );
}

/**
 * Resolves a member's grants independently of the requesting credential.
 * @param options - Authentication module configuration.
 * @param member - The workspace membership to inspect or change.
 * @returns Effective permissions from the member's roles and direct grants.
 * @internal
 */
export function resolveWorkspaceMemberPermissions(
  options: AuthModuleOptions,
  member: WorkspaceMember,
): string[] {
  return resolveAuthPermissions(
    member.roles ?? [options.workspace?.defaultRole ?? DEFAULT_WORKSPACE_ROLE],
    member.permissions ?? [],
    resolveAuthCatalog(options, "workspace").roles,
  ).filter((permission) =>
    isAuthPermissionEnabled(options, "workspace", permission),
  );
}

/**
 * Returns only permissions present in both inputs.
 * @param permissions - Permission names to apply.
 * @param ceiling - Maximum permissions allowed by the owning principal.
 * @returns Requested permissions that also occur in the ceiling.
 * @internal
 */
export function intersectPermissions(
  permissions: readonly string[],
  ceiling: readonly string[],
): string[] {
  const allowed = new Set(ceiling);
  return permissions.filter((permission) => allowed.has(permission));
}

/**
 * Resolves role grants using the same feature switches as the issuer ceiling.
 * @param options - Authentication feature configuration.
 * @param scope - Identity scope being delegated.
 * @param roles - Roles proposed for the receiving identity.
 * @returns Grants that these roles confer with the current features enabled.
 * @internal
 */
export function resolveRolePermissions(
  options: AuthModuleOptions,
  scope: "user" | "workspace",
  roles: readonly string[],
): string[] {
  return resolveAuthPermissions(
    roles,
    [],
    resolveAuthCatalog(options, scope).roles,
  ).filter((permission) => isAuthPermissionEnabled(options, scope, permission));
}
