import { BadRequestException } from "@nestjs/common";

import type { AuthRole } from "../interfaces/auth-role.interface.js";
import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";

/** Converts configured roles into transport-friendly role records. */
export function listAuthRoles(roles: AuthModuleRoles): AuthRole[] {
  return Object.entries(roles).map(([name, permissions]) => ({
    name,
    permissions: [...permissions],
  }));
}

/** Returns a deduplicated configured permission catalog. */
export function listAuthPermissions(permissions: readonly string[]): string[] {
  return [...new Set(permissions)];
}

/** Ensures every role grant belongs to its scope's permission catalog. */
export function assertAuthRolePermissions(
  roles: AuthModuleRoles,
  permissions: readonly string[],
  scope: "user" | "workspace",
): void {
  const availablePermissions = new Set(permissions);

  for (const [role, rolePermissions] of Object.entries(roles)) {
    const unknownPermissions = rolePermissions.filter(
      (permission) => !availablePermissions.has(permission),
    );
    if (unknownPermissions.length > 0) {
      throw new Error(
        `Role "${role}" contains unknown ${scope} permissions: ${unknownPermissions.join(", ")}`,
      );
    }
  }
}

/** Validates and normalizes one or more assigned role names. */
export function normalizeAuthRoles(
  value: string | readonly string[],
  roles: AuthModuleRoles,
): string[] {
  const normalized = [value]
    .flat()
    .flatMap((role) => role.split(","))
    .map((role) => role.trim())
    .filter(Boolean)
    .filter((role, index, values) => values.indexOf(role) === index);

  if (normalized.length === 0) {
    throw new BadRequestException("At least one role is required");
  }

  const unknownRoles = normalized.filter((role) => !(role in roles));
  if (unknownRoles.length > 0) {
    throw new BadRequestException(
      `Unknown role${unknownRoles.length === 1 ? "" : "s"}: ${unknownRoles.join(", ")}`,
    );
  }

  return normalized;
}

/** Resolves role grants and direct permissions into one permission list. */
export function resolveAuthPermissions(
  assignedRoles: readonly string[],
  directPermissions: readonly string[],
  roles: AuthModuleRoles,
): string[] {
  return [
    ...new Set([
      ...assignedRoles.flatMap((role) => roles[role] ?? []),
      ...directPermissions,
    ]),
  ];
}
