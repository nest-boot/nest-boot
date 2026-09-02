import type { Subject } from "@casl/ability";

import type { CanOptions } from "../interfaces/can-options.interface.js";
import { getPermissionAbility } from "./get-permission-ability.util.js";

/** Checks a permission with the ability prepared for the current request. */
export function can(
  action: string,
  subject: Subject,
  options: CanOptions = {},
): boolean {
  return getPermissionAbility(options.scope ?? "workspace").can(
    action,
    subject,
  );
}
