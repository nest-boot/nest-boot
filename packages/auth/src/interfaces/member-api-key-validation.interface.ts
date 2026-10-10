import type { Member } from "../entities/member.entity.js";
import type { MemberApiKey } from "../entities/member-api-key.entity.js";
import type { User } from "../entities/user.entity.js";
import type { Workspace } from "../entities/workspace.entity.js";

/** Successful authentication for a member-owned, workspace-scoped API key. */
export interface MemberApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: MemberApiKey;
  /** Identifies the owner branch. */
  ownerType: "member";
  /** Member represented by the key. */
  member: Member;
  /** Login user when the owner is a user member. */
  user: User | null;
  /** Workspace represented by the key. */
  workspace: Workspace;
}
