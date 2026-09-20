/** Default selections and grant limits for one API-key owner type. */
export interface AuthModuleApiKeyScopeOptions<
  Permission extends string = string,
> {
  /** Permissions used only when creation omits permissions. Defaults to an empty list. */
  defaultPermissions?: readonly Permission[];
  /** Grant ceiling within this scope's catalog. Omitted means the full catalog; an empty list allows no grants. */
  allowedPermissions?: readonly Permission[];
}
