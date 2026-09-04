import type {
  AuthWorkspaceMemberStatus,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "../entities/index.js";

/** Input accepted when creating a workspace. */
export interface CreateWorkspaceOptions {
  /** Workspace display name. */
  name: string;
}

/** Input accepted when updating a workspace. */
export interface UpdateWorkspaceOptions {
  /** New workspace display name. */
  name?: string;
}

/** Input accepted when adding a workspace member. */
export interface AddWorkspaceMemberOptions {
  /** Member roles. Defaults to `workspace.defaultRole`. */
  roles?: string[];
  /** Additional permissions from the configured workspace permission catalog. */
  permissions?: string[];
}

/** Mutable workspace-member fields. */
export interface UpdateWorkspaceMemberOptions {
  /** Member display name. */
  name?: string;
  /** Member email address. */
  email?: string | null;
  /** Member lifecycle status. */
  status?: Extract<AuthWorkspaceMemberStatus, "ACTIVE" | "DISABLED">;
}

/** Input accepted when creating a workspace invitation. */
export interface CreateWorkspaceInvitationOptions {
  /** Email address allowed to accept the invitation. */
  email: string;
  /** Roles granted after acceptance. Defaults to `workspace.defaultRole`. */
  roles?: string[];
  /** Invitation lifetime in seconds; defaults to 48 hours. */
  expiresIn?: number;
}

/** Result returned after accepting a workspace invitation. */
export interface AcceptWorkspaceInvitationResult<
  WorkspaceInvitation extends BaseWorkspaceInvitation = BaseWorkspaceInvitation,
  WorkspaceMember extends BaseWorkspaceMember = BaseWorkspaceMember,
> {
  /** Invitation after it has been marked as accepted. */
  invitation: WorkspaceInvitation;
  /** Workspace member created for the recipient. */
  member: WorkspaceMember;
}

/** Workspace details with members and invitation lifecycle records. */
export interface FullWorkspace<
  Workspace extends BaseWorkspace = BaseWorkspace,
  WorkspaceMember extends BaseWorkspaceMember = BaseWorkspaceMember,
  WorkspaceInvitation extends BaseWorkspaceInvitation = BaseWorkspaceInvitation,
> {
  /** Workspace entity. */
  workspace: Workspace;
  /** Active and disabled members. */
  members: WorkspaceMember[];
  /** Invitation lifecycle records. */
  invitations: WorkspaceInvitation[];
}

/** Permission statements checked against a workspace member. */
export interface WorkspaceHasPermissionOptions {
  /** Permission actions grouped by subject name. */
  permissions: Record<string, string[]>;
}
