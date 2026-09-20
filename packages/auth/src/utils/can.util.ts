import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { AccessControlService } from "../services/access-control.service.js";

/** Checks the unified request ability, denying access when context is unavailable. */
export function can(action: string, subject: Subject, field?: string): boolean {
  if (!RequestContext.isActive()) return false;
  const access = RequestContext.get(AccessControlService);
  return (
    (field === undefined
      ? access?.can(action, subject)
      : access?.can(action, subject, field)) ?? false
  );
}
