import { t } from "i18next";

export function getRoleLabel(role: string) {
  switch (role) {
    case "owner":
      return t("member:role.owner");
    case "admin":
      return t("member:role.admin");
    case "member":
      return t("member:role.member");
    default:
      return role;
  }
}

export function getRolesLabel(roles: ReadonlyArray<string>): string {
  return roles.map(getRoleLabel).join(", ");
}
