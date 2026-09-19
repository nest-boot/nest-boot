import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import type { Member } from "../entities/member.entity.js";
import type { User } from "../entities/user.entity.js";
import { DEFAULT_USER_ROLE } from "../user.constants.js";
import { DEFAULT_WORKSPACE_ROLE } from "../workspace.constants.js";
import { resolveAuthPermissions } from "./auth-role.util.js";
import { resolveAuthCatalog } from "./resolve-auth-catalog.util.js";

/** Resolves an owner's grants independently of the requesting credential. @internal */
export function resolveUserPermissions(
  options: AuthModuleOptions,
  user: User,
): string[] {
  return resolveAuthPermissions(
    user.roles ?? [options.user?.defaultRole ?? DEFAULT_USER_ROLE],
    user.permissions ?? [],
    resolveAuthCatalog(options, "user").roles,
  );
}

/** Resolves a member's grants independently of the requesting credential. @internal */
export function resolveMemberPermissions(
  options: AuthModuleOptions,
  member: Member,
): string[] {
  return resolveAuthPermissions(
    member.roles ?? [options.workspace?.defaultRole ?? DEFAULT_WORKSPACE_ROLE],
    member.permissions ?? [],
    resolveAuthCatalog(options, "workspace").roles,
  );
}

/** Applies a credential ceiling without treating an empty list as unrestricted. @internal */
export function intersectPermissions(
  permissions: readonly string[],
  ceiling: readonly string[],
): string[] {
  const allowed = new Set(ceiling);
  return permissions.filter((permission) => allowed.has(permission));
}
