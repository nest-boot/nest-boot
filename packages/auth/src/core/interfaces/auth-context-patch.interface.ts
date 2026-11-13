import type { ApiKeyObject } from "../../api-key/objects/api-key.object.js";
import type { Workspace } from "../../workspace/entities/workspace.entity.js";
import type { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import type { Session } from "../entities/session.entity.js";
import type { User } from "../entities/user.entity.js";

/**
 * Identity values staged together by the auth infrastructure.
 * @internal
 */
export interface AuthContextPatch {
  user?: User | null;
  member?: WorkspaceMember | null;
  workspace?: Workspace | null;
  session?: Session | null;
  apiKey?: ApiKeyObject | null;
}
