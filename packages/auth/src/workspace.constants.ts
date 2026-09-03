import type { AuthModuleRoles } from "./types/auth-module-roles.type.js";

/** Role assigned to regular workspace members by default. */
export const DEFAULT_WORKSPACE_ROLE = "member";

/** Role assigned to workspace creators by default. */
export const DEFAULT_WORKSPACE_CREATOR_ROLE = "owner";

/** Permissions available to the default workspace roles. */
export const DEFAULT_WORKSPACE_PERMISSIONS = [
  "workspace:update",
  "workspace:delete",
  "workspaceMember:create",
  "workspaceMember:update",
  "workspaceMember:delete",
  "workspaceInvitation:create",
  "workspaceInvitation:cancel",
] as const;

/** Default workspace roles modelled after Better Auth's organization access control. */
export const DEFAULT_WORKSPACE_ROLES = {
  /** Grants every default workspace permission. */
  owner: DEFAULT_WORKSPACE_PERMISSIONS,
  /** Grants workspace administration except workspace deletion. */
  admin: [
    "workspace:update",
    "workspaceMember:create",
    "workspaceMember:update",
    "workspaceMember:delete",
    "workspaceInvitation:create",
    "workspaceInvitation:cancel",
  ],
  /** Grants no workspace-administration permissions. */
  member: [],
} as const satisfies AuthModuleRoles;
