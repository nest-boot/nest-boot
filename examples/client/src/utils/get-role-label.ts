import { t } from "i18next";

export function getRoleLabel(role: string) {
  switch (role) {
    case "owner":
      return t("workspace-member:role.owner");
    case "admin":
      return t("workspace-member:role.admin");
    case "member":
      return t("workspace-member:role.member");
    default:
      return role;
  }
}

export function getRolesLabel(roles: ReadonlyArray<string>): string {
  return roles.map(getRoleLabel).join(", ");
}
