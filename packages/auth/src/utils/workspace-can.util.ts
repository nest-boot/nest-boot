import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { AccessControlService } from "../services/access-control.service.js";

/** Checks a permission with the workspace ability prepared for the request. */
export function workspaceCan(action: string, subject: Subject): boolean {
  if (!RequestContext.isActive()) return false;

  return (
    RequestContext.get(AccessControlService)?.workspaceCan(action, subject) ??
    false
  );
}
