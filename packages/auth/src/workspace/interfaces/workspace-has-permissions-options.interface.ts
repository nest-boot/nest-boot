/** Permission statements checked against a workspace member. */
export interface WorkspaceHasPermissionsOptions {
  /** Permission actions grouped by subject name. */
  permissions: Record<string, string[]>;
}
