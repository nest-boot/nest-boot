/** Permission statements checked against a user's flattened permissions. */
export interface UserHasPermissionsOptions {
  /** Permission actions grouped by subject name. */
  permissions: Record<string, string[]>;
}
