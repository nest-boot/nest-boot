import { type Invitation } from "../entities/invitation.entity.js";
import {
  type AuthMemberStatus,
  type Member,
} from "../entities/member.entity.js";
import { type Workspace } from "../entities/workspace.entity.js";

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
export interface AddMemberOptions {
  /** Member roles. Defaults to `workspace.defaultRole`. */
  roles?: string[];
  /** Additional permissions from the configured workspace permission catalog. */
  permissions?: string[];
}

/** Mutable member fields. */
export interface UpdateMemberOptions {
  /** Workspace-visible member name; does not update the user's profile. */
  name?: string;
  /** Workspace-visible contact email; does not change the login email. */
  email?: string | null;
  /** Member lifecycle status. */
  status?: Extract<AuthMemberStatus, "ACTIVE" | "DISABLED">;
}

/** Input accepted when creating a workspace invitation. */
export interface CreateInvitationOptions {
  /** Email address allowed to accept the invitation. */
  email: string;
  /** Roles granted after acceptance. Defaults to `workspace.defaultRole`. */
  roles?: string[];
  /** Invitation lifetime in seconds; defaults to 48 hours. */
  expiresIn?: number;
}

/** Domain result of accepting an invitation; GraphQL exposes only its identifiers. */
export interface AcceptInvitationResult {
  /** Accepted invitation. */
  invitation: Invitation;
  /** Resulting workspace membership. */
  member: Member;
}

/** Workspace details with members and invitation lifecycle records. */
export interface FullWorkspace {
  /** Workspace entity. */
  workspace: Workspace;
  /** Active and disabled members. */
  members: Member[];
  /** Invitation lifecycle records. */
  invitations: Invitation[];
}

/** Permission statements checked against a workspace member. */
export interface WorkspaceHasPermissionsOptions {
  /** Permission actions grouped by subject name. */
  permissions: Record<string, string[]>;
}
