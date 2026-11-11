import type { ApiKeyMetadata } from "../../api-key/types/api-key-metadata.type.js";
import type { Member } from "../../workspace/entities/member.entity.js";
import type { Workspace } from "../../workspace/entities/workspace.entity.js";
import type { Session } from "../entities/session.entity.js";
import type { User } from "../entities/user.entity.js";

/**
 * Identity values staged together by the auth infrastructure.
 * @internal
 */
export interface RequestIdentityPatch {
  user?: User | null;
  member?: Member | null;
  workspace?: Workspace | null;
  session?: Session | null;
  apiKey?: ApiKeyMetadata | null;
}
