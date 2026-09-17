import {
  UserApiKeyPermission,
  UserPermission,
  WorkspaceApiKeyPermission,
  WorkspacePermission,
} from "@/gql/graphql";

export type { UserPermission, WorkspacePermission } from "@/gql/graphql";

export type AuthPermission = UserApiKeyPermission;

export const userPermissionValues = Object.values(UserPermission);
export const workspacePermissionValues = Object.values(WorkspacePermission);
export const authPermissionValues = Object.values(UserApiKeyPermission);
export const workspaceApiKeyPermissionValues = Object.values(
  WorkspaceApiKeyPermission,
);

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
): PermissionOption<Permission> {
  // Only translation keys are formatted; the transmitted enum value is unchanged.
  const key = value.toLowerCase().replaceAll("__", "_");
  return {
    value,
    name: `permission:${key}.name`,
    description: `permission:${key}.description`,
  };
}

export const userPermissionOptions = userPermissionValues.map(option);
export const workspacePermissionOptions = workspacePermissionValues.map(option);
export const authPermissionOptions = authPermissionValues.map(option);
export const workspaceApiKeyPermissionOptions =
  workspaceApiKeyPermissionValues.map(option);
