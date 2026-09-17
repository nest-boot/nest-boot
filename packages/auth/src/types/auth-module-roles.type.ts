import type { RoleName } from "./role-name.type.js";

/** Maps each application-defined role to the permission strings it grants. */
export type AuthModuleRoles<
  Permission extends string = string,
  Role extends string = string,
> = Readonly<Record<Role, readonly Permission[]>> &
  (string extends Role
    ? unknown
    : Record<Exclude<Role, RoleName<Role>>, never>);
