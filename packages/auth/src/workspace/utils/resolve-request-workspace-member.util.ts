import { RequestContext } from "@nest-boot/request-context";

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { SELECTED_WORKSPACE } from "../../core/constants/auth.constants.js";
import { User } from "../../core/entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";

/**
 * Resolves active membership matching both the selected workspace and credential owner.
 * @returns Authenticated member after checking its type and user association, or null.
 * @internal
 */
export function resolveRequestWorkspaceMember(): WorkspaceMember | null {
  if (!RequestContext.isActive()) {
    return null;
  }
  const member = RequestContext.get(WorkspaceMember);
  const workspace = RequestContext.get<Workspace | null>(SELECTED_WORKSPACE);
  if (
    !workspace ||
    member?.status !== "ACTIVE" ||
    member.workspace?.id !== workspace.id
  ) {
    return null;
  }

  const apiKey = getCurrentApiKey();
  if (apiKey?.ownerType === "workspace_member") {
    return member.id === apiKey.member?.id ? member : null;
  }

  const user = RequestContext.get(User);
  return user && member.user?.id === user.id ? member : null;
}
