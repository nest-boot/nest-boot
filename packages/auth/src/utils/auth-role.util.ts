import { BadRequestException } from "@nestjs/common";

import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";

/** Returns a deduplicated configured permission catalog. */
export function listAuthPermissions(permissions: readonly string[]): string[] {
  return [...new Set(permissions)];
}

/** Validates permission values by exact, case-sensitive catalog membership. */
export function normalizeAuthPermissions(
  value: readonly string[],
  availablePermissions: readonly string[],
  label: string,
): string[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (permission) =>
        typeof permission !== "string" ||
        permission.length === 0 ||
        permission.trim() !== permission,
    )
  ) {
    throw new BadRequestException(
      `${label} permissions must contain non-empty strings`,
    );
  }

  const duplicatePermissions = [
    ...new Set(
      value.filter((permission, index) => value.indexOf(permission) !== index),
    ),
  ];
  if (duplicatePermissions.length > 0) {
    throw new BadRequestException(
      `${label} contains duplicate permissions: ${duplicatePermissions.join(", ")}`,
    );
  }

  const availablePermissionSet = new Set(availablePermissions);
  const unknownPermissions = value.filter(
    (permission) => !availablePermissionSet.has(permission),
  );
  if (unknownPermissions.length > 0) {
    throw new BadRequestException(
      `${label} contains unknown permissions: ${unknownPermissions.join(", ")}`,
    );
  }

  return [...value];
}

/** Ensures every role grant belongs to its scope's permission catalog. */
export function assertAuthRolePermissions(
  roles: AuthModuleRoles,
  permissions: readonly string[],
  scope: "user" | "workspace",
): void {
  for (const permission of permissions) {
    if (
      typeof permission !== "string" ||
      permission.trim() !== permission ||
      permission.includes("--") ||
      !/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/u.test(permission)
    ) {
      throw new Error(
        `Invalid ${scope} permission name: ${JSON.stringify(permission)}`,
      );
    }
  }
  const availablePermissions = new Set(permissions);

  for (const [role, rolePermissions] of Object.entries(roles)) {
    if (
      role.trim() !== role ||
      role.includes("--") ||
      !/^[a-z][a-z0-9-]*$/u.test(role) ||
      ["true", "false", "null"].includes(role)
    ) {
      throw new Error(`Invalid ${scope} role name: ${JSON.stringify(role)}`);
    }
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

/** Ensures one configured permission list belongs to the available catalog. */
export function assertAuthPermissionList(
  permissions: readonly string[],
  availablePermissions: readonly string[],
  option: string,
): void {
  try {
    normalizeAuthPermissions(permissions, availablePermissions, option);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : `${option} is invalid`,
      { cause: error },
    );
  }
}

/** Ensures every permission in one configured list is allowed by another. */
export function assertAuthPermissionSubset(
  permissions: readonly string[],
  allowedPermissions: readonly string[],
  option: string,
  allowedOption = "apiKey.allowedPermissions",
): void {
  const allowedPermissionSet = new Set(allowedPermissions);
  const disallowedPermissions = permissions.filter(
    (permission) => !allowedPermissionSet.has(permission),
  );
  if (disallowedPermissions.length > 0) {
    throw new Error(
      `${option} contains permissions outside ${allowedOption}: ${disallowedPermissions.join(", ")}`,
    );
  }
}

/** Ensures configured lifecycle roles exist in their role registry. */
export function assertAuthRolesExist(
  roles: AuthModuleRoles,
  roleNames: readonly string[],
  option: string,
): void {
  const invalidRoleNames = roleNames.filter(
    (role) =>
      typeof role !== "string" ||
      role.length === 0 ||
      role.trim() !== role ||
      !Object.hasOwn(roles, role),
  );
  if (invalidRoleNames.length > 0) {
    throw new Error(
      `${option} references unknown role${invalidRoleNames.length === 1 ? "" : "s"} ${invalidRoleNames.map((role) => JSON.stringify(role)).join(", ")}`,
    );
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

  const unknownRoles = normalized.filter((role) => !Object.hasOwn(roles, role));
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
      ...assignedRoles.flatMap((role) =>
        Object.hasOwn(roles, role) ? (roles[role] ?? []) : [],
      ),
      ...directPermissions,
    ]),
  ];
}
