/** Maps each application-defined role to the permission strings it grants. */
export type AuthModuleRoles<Permission extends string = string> = Readonly<
  Record<string, readonly Permission[]>
>;
