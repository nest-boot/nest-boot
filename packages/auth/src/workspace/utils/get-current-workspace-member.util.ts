import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { User } from "../../core/entities/user.entity.js";
import type { WorkspaceMember } from "../entities/workspace-member.entity.js";
import { resolveRequestWorkspaceMember } from "./resolve-request-workspace-member.util.js";
/**
 * Returns the active membership and rejects credentials without workspace access.
 * @returns Active workspace membership, or null when none is selected.
 */
export function getCurrentWorkspaceMember(): WorkspaceMember | null {
  const member = resolveRequestWorkspaceMember();
  if (getCurrentApiKey() && RequestContext.get(User) && !member) {
    throw new ForbiddenException(
      "The API key owner is not a member of this workspace",
    );
  }
  return member;
}
