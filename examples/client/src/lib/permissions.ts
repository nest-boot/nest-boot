const t = (key: string) => key;

const apiKeyPermissionValues = [
  "api-key:read",
  "api-key:create",
  "api-key:update",
  "api-key:delete",
] as const;

export const workspacePermissionValues = [
  "workspace:update",
  "workspace:delete",
  "member:create",
  "member:update",
  "member:delete",
  "invitation:create",
  "invitation:cancel",
  ...apiKeyPermissionValues,
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
  ...apiKeyPermissionValues,
] as const;

export type UserPermission = (typeof userPermissionValues)[number];

export const workspaceApiKeyPermissionValues = workspacePermissionValues;
export const authPermissionValues = [
  ...new Set([...userPermissionValues, ...workspacePermissionValues]),
];

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

const apiKeyPermissionOptions = [
  option("api-key:read", "api_key_read"),
  option("api-key:create", "api_key_create"),
  option("api-key:update", "api_key_update"),
  option("api-key:delete", "api_key_delete"),
] as const;

export const workspacePermissionOptions = [
  option("workspace:update", "workspace_update"),
  option("workspace:delete", "workspace_delete"),
  option("member:create", "member_create"),
  option("member:update", "member_update"),
  option("member:delete", "member_delete"),
  option("invitation:create", "invitation_create"),
  option("invitation:cancel", "invitation_cancel"),
  ...apiKeyPermissionOptions,
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
  ...apiKeyPermissionOptions,
] as const satisfies ReadonlyArray<PermissionOption<UserPermission>>;

export const authPermissionOptions = [
  ...new Map(
    [...userPermissionOptions, ...workspacePermissionOptions].map((entry) => [
      entry.value,
      entry,
    ]),
  ).values(),
] satisfies ReadonlyArray<PermissionOption<AuthPermission>>;
