import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { AccessControlService } from "../services/access-control.service.js";

/** Checks a permission with the user ability prepared for the current request. */
export function userCan(action: string, subject: Subject): boolean {
  if (!RequestContext.isActive()) return false;

  return (
    RequestContext.get(AccessControlService)?.userCan(action, subject) ?? false
  );
}
