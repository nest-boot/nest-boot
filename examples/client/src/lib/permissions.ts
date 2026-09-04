const t = (key: string) => key;

export const workspacePermissionValues = [
  "workspace:update",
  "workspace:delete",
  "workspaceMember:create",
  "workspaceMember:update",
  "workspaceMember:delete",
  "workspaceInvitation:create",
  "workspaceInvitation:cancel",
] as const;

export type WorkspacePermission = (typeof workspacePermissionValues)[number];

export const userPermissionValues = [
  "user:create",
  "user:list",
  "user:set-role",
  "user:ban",
  "user:impersonate",
  "user:impersonate-admins",
  "user:delete",
  "user:set-password",
  "user:set-email",
  "user:get",
  "user:update",
  "session:list",
  "session:revoke",
  "session:delete",
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
  option("workspace:update", "workspace_update"),
  option("workspace:delete", "workspace_delete"),
  option("workspaceMember:create", "workspace_member_create"),
  option("workspaceMember:update", "workspace_member_update"),
  option("workspaceMember:delete", "workspace_member_delete"),
  option("workspaceInvitation:create", "workspace_invitation_create"),
  option("workspaceInvitation:cancel", "workspace_invitation_cancel"),
] as const satisfies ReadonlyArray<PermissionOption<WorkspacePermission>>;

export const workspaceApiKeyPermissionOptions = workspacePermissionOptions;

export const userPermissionOptions = [
  option("user:create", "user_create"),
  option("user:list", "user_list"),
  option("user:set-role", "user_set_role"),
  option("user:ban", "user_ban"),
  option("user:impersonate", "user_impersonate"),
  option("user:impersonate-admins", "user_impersonate_admins"),
  option("user:delete", "user_delete"),
  option("user:set-password", "user_set_password"),
  option("user:set-email", "user_set_email"),
  option("user:get", "user_get"),
  option("user:update", "user_update"),
  option("session:list", "session_list"),
  option("session:revoke", "session_revoke"),
  option("session:delete", "session_delete"),
] as const satisfies ReadonlyArray<PermissionOption<UserPermission>>;

export const authPermissionOptions = [
  ...userPermissionOptions,
  ...workspacePermissionOptions,
] as const satisfies ReadonlyArray<PermissionOption<AuthPermission>>;
