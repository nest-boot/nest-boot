/** Input accepted when adding a workspace member. */
export interface AddMemberOptions {
  /** Member roles. Defaults to `workspace.defaultRole`. */
  roles?: string[];
  /** Additional permissions from the configured workspace permission catalog. */
  permissions?: string[];
}
