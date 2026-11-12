import { t } from "i18next";

export function getRoleLabel(role: string) {
  switch (role) {
    case "OWNER":
      return t("workspace-member:role.owner");
    case "ADMIN":
      return t("workspace-member:role.admin");
    case "USER":
      return t("workspace-member:role.user");
    case "MEMBER":
      return t("workspace-member:role.member");
    default:
      return role;
  }
}

export function getRolesLabel(roles: ReadonlyArray<string>): string {
  return roles.map(getRoleLabel).join(", ");
}
