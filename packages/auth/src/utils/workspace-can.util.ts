import type { Subject } from "@casl/ability";

import { getWorkspaceAbility } from "./get-workspace-ability.util.js";

/** Checks a permission with the workspace ability prepared for the request. */
export function workspaceCan(action: string, subject: Subject): boolean {
  return getWorkspaceAbility().can(action, subject);
}
