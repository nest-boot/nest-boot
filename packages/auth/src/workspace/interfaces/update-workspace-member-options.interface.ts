import type { AuthWorkspaceMemberStatus } from "../entities/workspace-member.entity.js";

/** Mutable member fields. */
export interface UpdateWorkspaceMemberOptions {
  /** Workspace-visible member name; does not update the user's profile. */
  name?: string;
  /** Workspace-visible contact email; does not change the login email. */
  email?: string | null;
  /** WorkspaceMember lifecycle status. */
  status?: Extract<AuthWorkspaceMemberStatus, "ACTIVE" | "DISABLED">;
}
