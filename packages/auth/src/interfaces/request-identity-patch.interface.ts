import type { Member } from "../entities/member.entity.js";
import type { Session } from "../entities/session.entity.js";
import type { User } from "../entities/user.entity.js";
import type { Workspace } from "../entities/workspace.entity.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** Identity values staged together by the auth infrastructure. @internal */
export interface RequestIdentityPatch {
  user?: User | null;
  member?: Member | null;
  workspace?: Workspace | null;
  session?: Session | null;
  apiKey?: ApiKeyMetadata | null;
}
