import { registerEnumType } from "@nest-boot/graphql";

import { DEFAULT_USER_ROLES } from "../user.constants.js";

/** Original user role value; the catalog is configured at runtime. */
export type UserRole = string;

/** User role values populated from AuthModule configuration before schema generation. */
export const UserRole: Record<string, string> = Object.fromEntries(
  Object.keys(DEFAULT_USER_ROLES).map((role) => [role.toUpperCase(), role]),
);

registerEnumType(UserRole, { name: "UserRole" });
