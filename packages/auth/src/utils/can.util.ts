import type { Subject } from "@casl/ability";

import type { CanOptions } from "../interfaces/can-options.interface.js";
import { userCan } from "./user-can.util.js";
import { workspaceCan } from "./workspace-can.util.js";

/** Routes a permission check to its scoped implementation. */
export function can(
  action: string,
  subject: Subject,
  options: CanOptions = {},
): boolean {
  return options.scope === "user"
    ? userCan(action, subject)
    : workspaceCan(action, subject);
}
