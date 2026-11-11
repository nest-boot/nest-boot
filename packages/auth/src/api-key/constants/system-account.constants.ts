/** Platform operations available to independent system accounts. */
export const DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS = [
  "user:read",
  "user:update",
  "user:delete",
  "workspace:read-any",
  "workspace:update-any",
  "workspace:delete-any",
] as const;
