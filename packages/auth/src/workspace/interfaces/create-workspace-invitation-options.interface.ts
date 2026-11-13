/** Input accepted when creating a workspace invitation. */
export interface CreateWorkspaceInvitationOptions {
  /** Email address allowed to accept the invitation. */
  email: string;
  /** Roles granted after acceptance. Defaults to `workspace.defaultRole`. */
  roles?: string[];
  /** WorkspaceInvitation lifetime in seconds; defaults to 48 hours. */
  expiresIn?: number;
}
