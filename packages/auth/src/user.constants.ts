import type { AuthModuleRoles } from "./types/auth-module-roles.type.js";

/** Role assigned to users by default. */
export const DEFAULT_USER_ROLE = "user";

/** Roles classified as administrators by default. */
export const DEFAULT_USER_ADMIN_ROLES = ["admin"] as const;

/** Permissions available to the default user roles. */
export const DEFAULT_USER_PERMISSIONS = [
  "user:create",
  "user:read",
  "user:set-roles",
  "user:set-permissions",
  "user:ban",
  "user:impersonate",
  "user:impersonate-admin",
  "user:delete",
  "user:set-password",
  "user:set-email",
  "user:update",
  "session:read",
  "session:revoke",
  "user-api-key:read",
  "user-api-key:write",
  "workspace:create",
] as const;

/** Explicit default grants for user-scoped administration and workspace creation. */
export const DEFAULT_USER_ROLES = {
  /** Grants every default user permission. */
  admin: DEFAULT_USER_PERMISSIONS,
  /** Allows signed-in users to create workspaces, without user-administration grants. */
  user: ["workspace:create"],
} as const satisfies AuthModuleRoles;
