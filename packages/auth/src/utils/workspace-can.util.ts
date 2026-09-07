import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { AccessControlService } from "../access-control.service.js";
import { getWorkspaceAbility } from "./get-workspace-ability.util.js";

/** Checks a permission with the workspace ability prepared for the request. */
export function workspaceCan(action: string, subject: Subject): boolean {
  if (!RequestContext.isActive()) return false;

  const accessControlService = RequestContext.get(AccessControlService);
  if (accessControlService) {
    return accessControlService.workspaceCan(action, subject);
  }

  try {
    return getWorkspaceAbility().can(action, subject);
  } catch {
    return false;
  }
}
