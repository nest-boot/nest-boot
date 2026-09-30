import type { Subject } from "@casl/ability";

import { getAuthAbility } from "./get-auth-ability.util.js";

/** Throws ForbiddenException unless the current request permits the action. */
export function throwUnlessCan(
  action: string,
  subject: Subject,
  field?: string,
): void {
  getAuthAbility().throwUnlessCan(action, subject, field);
}
