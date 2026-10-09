import { RequestContext } from "@nest-boot/request-context";

import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";

/** Resolves active membership matching both the selected workspace and credential owner. @internal */
export function resolveRequestMember(): Member | null {
  if (!RequestContext.isActive()) return null;
  const member = RequestContext.get(Member);
  const workspace = RequestContext.get(Workspace);
  if (
    !workspace ||
    member?.status !== "ACTIVE" ||
    member.workspace?.id !== workspace.id
  )
    return null;

  const apiKey = getCurrentApiKey();
  if (apiKey instanceof MemberApiKey)
    return member.id === apiKey.member?.id ? member : null;

  const user = RequestContext.get(User);
  return user && member.user?.id === user.id ? member : null;
}
