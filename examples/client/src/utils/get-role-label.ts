import { t } from "i18next";
import { WorkspaceMemberRole } from "@/gql/graphql";

export function getRoleLabel(role: WorkspaceMemberRole) {
  switch (role) {
    case WorkspaceMemberRole.OWNER:
      return t("workspace-member:role.owner");
    case WorkspaceMemberRole.ADMIN:
      return t("workspace-member:role.admin");
    case WorkspaceMemberRole.MEMBER:
      return t("workspace-member:role.member");
    default:
      return role;
  }
}
