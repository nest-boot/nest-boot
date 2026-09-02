import { WorkspacePermission } from "@/gql/graphql";

// 让 i18next-cli 识别到语言 key
const t = (key: string) => key;

export const workspacePermissions: Record<
  WorkspacePermission,
  { name: string; description: string }
> = {
  [WorkspacePermission.MANAGE_WORKSPACE]: {
    name: t("permission:manage_workspace.name"),
    description: t("permission:manage_workspace.description"),
  },
  [WorkspacePermission.MANAGE_MEMBERS]: {
    name: t("permission:manage_members.name"),
    description: t("permission:manage_members.description"),
  },
};
