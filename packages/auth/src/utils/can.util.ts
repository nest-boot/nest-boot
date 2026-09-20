import type { Subject } from "@casl/ability";

import { readRequestAbility } from "./get-ability.util.js";

/** Checks an action, object, or field against the current request ability. */
export function can(action: string, subject: Subject, field?: string): boolean {
  const ability = readRequestAbility();
  if (!ability) return false;
  return field === undefined
    ? ability.can(action, subject)
    : ability.can(action, subject, field);
}
