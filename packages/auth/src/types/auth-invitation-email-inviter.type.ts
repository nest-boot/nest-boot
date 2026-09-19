import type { Member } from "../entities/member.entity.js";
import type { User } from "../entities/user.entity.js";

/** Workspace member and user that issued an invitation. */
export type AuthInvitationEmailInviter = Omit<Member, "user"> & {
  /** Authenticated user represented by the workspace membership. */
  user: User;
};
