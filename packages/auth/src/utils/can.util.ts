import type { Subject } from "@casl/ability";

import { getAuthAbility } from "./get-auth-ability.util.js";

/**
 * Checks the current request's ability on every call.
 * @param action - Permission action to check.
 * @param subject - Resource instance or type to authorize.
 * @param field - Field name to inspect.
 * @returns Whether the current ability permits the action on the subject and field.
 */
export function can(action: string, subject: Subject, field?: string): boolean {
  const ability = getAuthAbility();
  return field === undefined
    ? ability.can(action, subject)
    : ability.can(action, subject, field);
}
