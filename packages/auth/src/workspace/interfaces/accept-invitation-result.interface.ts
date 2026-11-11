import type { Invitation } from "../entities/invitation.entity.js";
import type { Member } from "../entities/member.entity.js";

/** Domain result of accepting an invitation; GraphQL exposes only its identifiers. */
export interface AcceptInvitationResult {
  /** Accepted invitation. */
  invitation: Invitation;
  /** Resulting workspace membership. */
  member: Member;
}
