/** API-key permission defaults and grant limits owned by AuthModule. */
export interface AuthModuleApiKeyOptions<Permission extends string = string> {
  /**
   * Permissions assigned when key creation omits `permissions`.
   * Shared by user and workspace keys, so values must belong to the workspace
   * catalog and allowedPermissions. Defaults to an empty list. User-only grants
   * must be supplied explicitly when creating a user key.
   */
  defaultPermissions?: readonly Permission[];
  /**
   * Permissions that may be granted to any API key.
   * Defaults to the combined user and workspace permission catalogs.
   */
  allowedPermissions?: readonly Permission[];
}
