import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { AccessControlService } from "../access-control.service.js";
import { getUserAbility } from "./get-user-ability.util.js";

/** Checks a permission with the user ability prepared for the current request. */
export function userCan(action: string, subject: Subject): boolean {
  if (!RequestContext.isActive()) return false;

  const accessControlService = RequestContext.get(AccessControlService);
  if (accessControlService) {
    return accessControlService.userCan(action, subject);
  }

  try {
    return getUserAbility().can(action, subject);
  } catch {
    return false;
  }
}
