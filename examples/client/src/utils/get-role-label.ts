import { t } from "i18next";

export function getRoleLabel(role: string) {
  switch (role) {
    case "OWNER":
      return t("member:role.owner");
    case "ADMIN":
      return t("member:role.admin");
    case "USER":
      return t("member:role.user");
    case "MEMBER":
      return t("member:role.member");
    default:
      return role;
  }
}

export function getRolesLabel(roles: ReadonlyArray<string>): string {
  return roles.map(getRoleLabel).join(", ");
}
