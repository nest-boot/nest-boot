const t = (key: string) => key;

export const workspacePermissionValues = [
  "Workspace:update",
  "Workspace:delete",
  "WorkspaceMember:create",
  "WorkspaceMember:update",
  "WorkspaceMember:delete",
  "WorkspaceInvitation:create",
  "WorkspaceInvitation:cancel",
] as const;

export type WorkspacePermission = (typeof workspacePermissionValues)[number];

export const userPermissionValues = [
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

export type UserPermission = (typeof userPermissionValues)[number];

export const workspaceApiKeyPermissionValues = workspacePermissionValues;
export const authPermissionValues = [
  ...userPermissionValues,
  ...workspacePermissionValues,
] as const;

export type AuthPermission = (typeof authPermissionValues)[number];

export function isWorkspacePermission(
  value: string,
): value is WorkspacePermission {
  return (workspacePermissionValues as ReadonlyArray<string>).includes(value);
}

export function isUserPermission(value: string): value is UserPermission {
  return (userPermissionValues as ReadonlyArray<string>).includes(value);
}

export function isAuthPermission(value: string): value is AuthPermission {
  return (authPermissionValues as ReadonlyArray<string>).includes(value);
}

export interface PermissionOption<Permission extends string> {
  value: Permission;
  name: string;
  description: string;
}

function option<Permission extends string>(
  value: Permission,
  key: string,
): PermissionOption<Permission> {
  return {
    value,
    name: t(`permission:${key}.name`),
    description: t(`permission:${key}.description`),
  };
}

export const workspacePermissionOptions = [
  option("Workspace:update", "workspace_update"),
  option("Workspace:delete", "workspace_delete"),
  option("WorkspaceMember:create", "workspace_member_create"),
  option("WorkspaceMember:update", "workspace_member_update"),
  option("WorkspaceMember:delete", "workspace_member_delete"),
  option("WorkspaceInvitation:create", "workspace_invitation_create"),
  option("WorkspaceInvitation:cancel", "workspace_invitation_cancel"),
] as const satisfies ReadonlyArray<PermissionOption<WorkspacePermission>>;

export const workspaceApiKeyPermissionOptions = workspacePermissionOptions;

export const userPermissionOptions = [
  option("User:create", "user_create"),
  option("User:list", "user_list"),
  option("User:set-role", "user_set_role"),
  option("User:ban", "user_ban"),
  option("User:impersonate", "user_impersonate"),
  option("User:impersonate-admins", "user_impersonate_admins"),
  option("User:delete", "user_delete"),
  option("User:set-password", "user_set_password"),
  option("User:set-email", "user_set_email"),
  option("User:get", "user_get"),
  option("User:update", "user_update"),
  option("Session:list", "session_list"),
  option("Session:revoke", "session_revoke"),
  option("Session:delete", "session_delete"),
] as const satisfies ReadonlyArray<PermissionOption<UserPermission>>;

export const authPermissionOptions = [
  ...userPermissionOptions,
  ...workspacePermissionOptions,
] as const satisfies ReadonlyArray<PermissionOption<AuthPermission>>;
