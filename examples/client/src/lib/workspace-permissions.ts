// 让 i18next-cli 识别到语言 key
const t = (key: string) => key;

export const workspacePermissions = {
  "workspace:manage": {
    resource: "workspace",
    action: "manage",
    name: t("permission:manage_workspace.name"),
    description: t("permission:manage_workspace.description"),
  },
  "workspaceMember:manage": {
    resource: "workspaceMember",
    action: "manage",
    name: t("permission:manage_members.name"),
    description: t("permission:manage_members.description"),
  },
} as const;

export type WorkspacePermission = keyof typeof workspacePermissions;

export function flattenWorkspacePermissions(
  permissions: Record<string, Array<string>> | null | undefined,
): Array<WorkspacePermission> {
  if (!permissions) {
    return [];
  }

  return Object.entries(workspacePermissions)
    .filter(([, definition]) =>
      permissions[definition.resource]?.includes(definition.action),
    )
    .map(([permission]) => permission as WorkspacePermission);
}

export function groupWorkspacePermissions(
  permissions: Array<WorkspacePermission>,
): Record<string, Array<string>> {
  return permissions.reduce<Record<string, Array<string>>>(
    (groupedPermissions, permission) => {
      const { resource, action } = workspacePermissions[permission];
      const actions = groupedPermissions[resource] ?? [];

      if (!actions.includes(action)) {
        actions.push(action);
      }

      groupedPermissions[resource] = actions;
      return groupedPermissions;
    },
    {},
  );
}
