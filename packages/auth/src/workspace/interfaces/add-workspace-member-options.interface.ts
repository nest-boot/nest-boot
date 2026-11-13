/** Input accepted when adding a workspace member. */
export interface AddWorkspaceMemberOptions {
  /** WorkspaceMember roles. Defaults to `workspace.defaultRole`; service accounts may use `[]`. */
  roles?: string[];
  /** Additional permissions from the configured workspace permission catalog. */
  permissions?: string[];
}
