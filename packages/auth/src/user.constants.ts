import type { AuthModuleRoles } from "./types/auth-module-roles.type.js";

/** Role assigned to users by default. */
export const DEFAULT_USER_ROLE = "user";

/** Roles classified as administrators by default. */
export const DEFAULT_USER_ADMIN_ROLES = ["admin"] as const;

/** Permissions available to the default user roles. */
export const DEFAULT_USER_PERMISSIONS = [
  "User:create",
  "User:list",
  "User:set-role",
  "User:ban",
  "User:impersonate",
  "User:impersonate-admins",
  "User:delete",
  "User:set-password",
  "User:set-email",
  "User:get",
  "User:update",
  "Session:list",
  "Session:revoke",
  "Session:delete",
] as const;

/** Default user roles modelled after Better Auth's admin access control. */
export const DEFAULT_USER_ROLES = {
  /** Grants every default user permission. */
  admin: DEFAULT_USER_PERMISSIONS,
  /** Grants no user permissions. */
  user: [],
} as const satisfies AuthModuleRoles;
