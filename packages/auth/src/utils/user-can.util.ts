import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { AuthorizationService } from "../authorization.service.js";
import { getUserAbility } from "./get-user-ability.util.js";

/** Checks a permission with the user ability prepared for the current request. */
export function userCan(action: string, subject: Subject): boolean {
  if (!RequestContext.isActive()) return false;

  const authorizationService = RequestContext.get(AuthorizationService);
  if (authorizationService) {
    return authorizationService.userCan(action, subject);
  }

  try {
    return getUserAbility().can(action, subject);
  } catch {
    return false;
  }
}
