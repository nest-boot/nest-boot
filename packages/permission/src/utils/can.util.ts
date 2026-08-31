import type { Subject } from "@casl/ability";

import type { PermissionAction } from "../enums/permission-action.enum.js";
import { getPermissionAbility } from "./get-permission-ability.util.js";

/** Checks a permission with the ability prepared for the current request. */
export function can(action: PermissionAction, subject: Subject): boolean {
  return getPermissionAbility().can(action, subject);
}
