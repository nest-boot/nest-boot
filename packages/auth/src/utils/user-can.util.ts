import type { Subject } from "@casl/ability";

import { getUserAbility } from "./get-user-ability.util.js";

/** Checks a permission with the user ability prepared for the current request. */
export function userCan(action: string, subject: Subject): boolean {
  return getUserAbility().can(action, subject);
}
