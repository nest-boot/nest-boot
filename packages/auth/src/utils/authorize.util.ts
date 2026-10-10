import type { Subject } from "@casl/ability";

import { getAuthAbility } from "./get-auth-ability.util.js";

/**
 * Throws ForbiddenException unless the current request permits the action.
 * @param action - Permission action to check.
 * @param subject - Resource instance or type to authorize.
 * @param field - Field name to inspect.
 */
export function authorize(
  action: string,
  subject: Subject,
  field?: string,
): void {
  getAuthAbility().authorize(action, subject, field);
}
