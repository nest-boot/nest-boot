import type { AuthMemberStatus } from "../entities/member.entity.js";

/** Mutable member fields. */
export interface UpdateMemberOptions {
  /** Workspace-visible member name; does not update the user's profile. */
  name?: string;
  /** Workspace-visible contact email; does not change the login email. */
  email?: string | null;
  /** Member lifecycle status. */
  status?: Extract<AuthMemberStatus, "ACTIVE" | "DISABLED">;
}
