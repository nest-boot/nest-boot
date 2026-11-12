import type { User } from "../../core/entities/user.entity.js";
import type { WorkspaceMember } from "../entities/workspace-member.entity.js";

/** Workspace member and user that issued an invitation. */
export type AuthWorkspaceInvitationEmailInviter = Omit<
  WorkspaceMember,
  "user"
> & {
  /** Authenticated user represented by the workspace membership. */
  user: User;
};
