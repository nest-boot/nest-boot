import type { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import type { WorkspaceMember } from "../entities/workspace-member.entity.js";

/** Domain result of accepting an invitation; GraphQL exposes only its identifiers. */
export interface AcceptWorkspaceInvitationResult {
  /** Accepted invitation. */
  invitation: WorkspaceInvitation;
  /** Resulting workspace membership. */
  member: WorkspaceMember;
}
