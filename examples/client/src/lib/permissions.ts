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

export function isAuthPermission(value: string): value is AuthPermission {
  return (authPermissionValues as ReadonlyArray<string>).includes(value);
}

export interface PermissionOption<Permission extends string> {
  value: Permission;
  name: string;
  description: string;
  grantable?: boolean;
}

/** Preselects server defaults without expanding the current caller's grant ceiling. */
export function getDefaultApiKeyPermissions<Permission extends string>(
  catalog: ReadonlyArray<{
    permission: Permission;
    grantable: boolean;
    default: boolean;
  }>,
): Array<Permission> {
  return catalog
    .filter((option) => option.default && option.grantable)
    .map((option) => option.permission);
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

/** Uses the server catalog as the source of available grants and adds UI labels. */
export function getPermissionOptions<Permission extends string>(
  catalog: ReadonlyArray<{ permission: Permission; grantable: boolean }>,
): Array<PermissionOption<Permission>> {
  return catalog.map(({ permission, grantable }) => ({
    ...option(permission),
    grantable,
  }));
}
