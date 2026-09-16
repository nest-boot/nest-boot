/** Role names configured by the example server. */
export const WORKSPACE_OWNER_ROLE = "owner";
export const WORKSPACE_ADMIN_ROLE = "admin";
export const WORKSPACE_MEMBER_ROLE = "member";

/** Built-in roles displayed by the example application. */
export const workspaceRoles = [
  WORKSPACE_OWNER_ROLE,
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MEMBER_ROLE,
] as const;

/** Configured roles available for assignment, subject to Service authorization. */
export const workspaceAssignableRoles = workspaceRoles;

export function hasWorkspaceRole(
  roles: ReadonlyArray<string>,
  role: string,
): boolean {
  return roles.includes(role);
}
