/** Credential defaults and grant limits for one API-key owner type. */
export interface AuthModuleApiKeyScopeOptions<
  Permission extends string = string,
> {
  /** Literal prefix, including separators. Falls back to API_KEY_PREFIX, then user_ for user keys or ws_ for member keys. */
  defaultPrefix?: string;
  /** Permissions used only when creation omits permissions. Defaults to an empty list. */
  defaultPermissions?: readonly Permission[];
  /** Ceiling for explicit permission selections; empty key permissions inherit the owner's full permissions. */
  allowedPermissions?: readonly Permission[];
}
