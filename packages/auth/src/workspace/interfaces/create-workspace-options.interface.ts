/** Input accepted when creating a workspace. */
export interface CreateWorkspaceOptions {
  /** Workspace display name. */
  name: string;
  /** Optional unique workspace URL slug. */
  slug?: string | null;
}
