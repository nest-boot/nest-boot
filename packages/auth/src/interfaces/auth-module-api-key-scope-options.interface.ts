/** Credential defaults and grant limits for one API-key owner type. */
export interface AuthModuleApiKeyScopeOptions<
  Permission extends string = string,
> {
  /** Literal prefix, including separators. Falls back to API_KEY_PREFIX, then user_ for user keys, ws_ for member keys, or sys_ for system-account keys. */
  defaultPrefix?: string;
  /** Permissions used only when creation omits permissions. Defaults to an empty list. */
  defaultPermissions?: readonly Permission[];
  /** Ceiling for explicit permission selections; empty user/member key permissions inherit owner grants, while empty system-account key permissions grant nothing. */
  allowedPermissions?: readonly Permission[];
}
