import type { Subject } from "@casl/ability";

import { getAuthAbility } from "./get-auth-ability.util.js";

/** Checks the current request's ability on every call. */
export function can(action: string, subject: Subject, field?: string): boolean {
  const ability = getAuthAbility();
  return field === undefined
    ? ability.can(action, subject)
    : ability.can(action, subject, field);
}
