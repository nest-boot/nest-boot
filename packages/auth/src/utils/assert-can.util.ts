import type { Subject } from "@casl/ability";
import { ForbiddenException } from "@nestjs/common";

import { can } from "./can.util.js";

/** Throws unless the current request ability permits the action, object, or field. */
export function assertCan(
  action: string,
  subject: Subject,
  field?: string,
): void {
  if (!can(action, subject, field))
    throw new ForbiddenException(
      `You are not allowed to ${action} this resource`,
    );
}
