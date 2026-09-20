import type { AuthModuleRoles } from "./types/auth-module-roles.type.js";

/** Role assigned to regular workspace members by default. */
export const DEFAULT_WORKSPACE_ROLE = "member";

/** Role assigned to workspace creators by default. */
export const DEFAULT_WORKSPACE_CREATOR_ROLE = "owner";

/** Permissions available to the default workspace roles. */
export const DEFAULT_WORKSPACE_PERMISSIONS = [
  "workspace:read",
  "workspace:update",
  "workspace:delete",
  "member:read",
  "member:write",
  "member:set-roles",
  "member:set-permissions",
  "member:invite",
  "workspace-api-key:read",
  "workspace-api-key:write",
] as const;

/** Explicit grants for workspace administration and ordinary membership. */
export const DEFAULT_WORKSPACE_ROLES = {
  /** Grants every default workspace permission. */
  owner: DEFAULT_WORKSPACE_PERMISSIONS,
  /** Grants membership/invitation administration without workspace deletion or key management. */
  admin: [
    "workspace:read",
    "workspace:update",
    "member:read",
    "member:write",
    "member:set-roles",
    "member:set-permissions",
    "member:invite",
  ],
  /** Allows members to read workspace and member profiles, but not invitations. */
  member: ["workspace:read", "member:read"],
} as const satisfies AuthModuleRoles;
