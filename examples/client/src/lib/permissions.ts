import { AuthPermission, WorkspacePermission } from "@/gql/graphql";

const t = (key: string) => key;

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
  option(WorkspacePermission.WORKSPACE_UPDATE, "workspace_update"),
  option(WorkspacePermission.WORKSPACE_DELETE, "workspace_delete"),
  option(
    WorkspacePermission.WORKSPACE_MEMBER_CREATE,
    "workspace_member_create",
  ),
  option(
    WorkspacePermission.WORKSPACE_MEMBER_UPDATE,
    "workspace_member_update",
  ),
  option(
    WorkspacePermission.WORKSPACE_MEMBER_DELETE,
    "workspace_member_delete",
  ),
  option(
    WorkspacePermission.WORKSPACE_INVITATION_CREATE,
    "workspace_invitation_create",
  ),
  option(
    WorkspacePermission.WORKSPACE_INVITATION_CANCEL,
    "workspace_invitation_cancel",
  ),
] as const satisfies ReadonlyArray<PermissionOption<WorkspacePermission>>;

export const workspaceApiKeyPermissionOptions = [
  option(AuthPermission.WORKSPACE_UPDATE, "workspace_update"),
  option(AuthPermission.WORKSPACE_DELETE, "workspace_delete"),
  option(AuthPermission.WORKSPACE_MEMBER_CREATE, "workspace_member_create"),
  option(AuthPermission.WORKSPACE_MEMBER_UPDATE, "workspace_member_update"),
  option(AuthPermission.WORKSPACE_MEMBER_DELETE, "workspace_member_delete"),
  option(
    AuthPermission.WORKSPACE_INVITATION_CREATE,
    "workspace_invitation_create",
  ),
  option(
    AuthPermission.WORKSPACE_INVITATION_CANCEL,
    "workspace_invitation_cancel",
  ),
] as const satisfies ReadonlyArray<PermissionOption<AuthPermission>>;

export const userPermissionOptions = [
  option(AuthPermission.USER_CREATE, "user_create"),
  option(AuthPermission.USER_LIST, "user_list"),
  option(AuthPermission.USER_SET_ROLE, "user_set_role"),
  option(AuthPermission.USER_BAN, "user_ban"),
  option(AuthPermission.USER_IMPERSONATE, "user_impersonate"),
  option(AuthPermission.USER_IMPERSONATE_ADMINS, "user_impersonate_admins"),
  option(AuthPermission.USER_DELETE, "user_delete"),
  option(AuthPermission.USER_SET_PASSWORD, "user_set_password"),
  option(AuthPermission.USER_SET_EMAIL, "user_set_email"),
  option(AuthPermission.USER_GET, "user_get"),
  option(AuthPermission.USER_UPDATE, "user_update"),
  option(AuthPermission.SESSION_LIST, "session_list"),
  option(AuthPermission.SESSION_REVOKE, "session_revoke"),
  option(AuthPermission.SESSION_DELETE, "session_delete"),
] as const satisfies ReadonlyArray<PermissionOption<AuthPermission>>;

export const authPermissionOptions = [
  ...userPermissionOptions,
  ...workspaceApiKeyPermissionOptions,
] as const satisfies ReadonlyArray<PermissionOption<AuthPermission>>;

export const workspacePermissionValues = workspacePermissionOptions.map(
  ({ value }) => value,
) as [WorkspacePermission, ...Array<WorkspacePermission>];

export const workspaceApiKeyPermissionValues =
  workspaceApiKeyPermissionOptions.map(({ value }) => value) as [
    AuthPermission,
    ...Array<AuthPermission>,
  ];

export const authPermissionValues = authPermissionOptions.map(
  ({ value }) => value,
) as [AuthPermission, ...Array<AuthPermission>];
