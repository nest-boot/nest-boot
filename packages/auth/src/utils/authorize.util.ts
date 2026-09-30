import type { Subject } from "@casl/ability";

import { getAuthAbility } from "./get-auth-ability.util.js";

/** Throws ForbiddenException unless the current request permits the action. */
export function authorize(
  action: string,
  subject: Subject,
  field?: string,
): void {
  getAuthAbility().authorize(action, subject, field);
}
