import type { MemberApiKey } from "../entities/member-api-key.entity.js";
import type { UserApiKey } from "../entities/user-api-key.entity.js";

/** A user-owned or member-owned, workspace-scoped API credential. */
export type ApiKey = UserApiKey | MemberApiKey;
