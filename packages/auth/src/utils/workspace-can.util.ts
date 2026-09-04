import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { AuthorizationService } from "../authorization.service.js";
import { getWorkspaceAbility } from "./get-workspace-ability.util.js";

/** Checks a permission with the workspace ability prepared for the request. */
export function workspaceCan(action: string, subject: Subject): boolean {
  if (!RequestContext.isActive()) return false;

  const authorizationService = RequestContext.get(AuthorizationService);
  if (authorizationService) {
    return authorizationService.workspaceCan(action, subject);
  }

  try {
    return getWorkspaceAbility().can(action, subject);
  } catch {
    return false;
  }
}
