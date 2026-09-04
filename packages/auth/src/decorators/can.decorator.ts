import type { Subject } from "@casl/ability";
import type { CustomDecorator } from "@nestjs/common";

import type { CanOptions } from "../interfaces/can-options.interface.js";
import {
  USER_CAN_METADATA,
  WORKSPACE_CAN_METADATA,
} from "../permission.constants.js";
import type { CanSubject } from "../types/can-subject.type.js";
import { UserCan } from "./user-can.decorator.js";
import { WorkspaceCan } from "./workspace-can.decorator.js";

/**
 * Routes a permission declaration to `UserCan` or `WorkspaceCan`.
 *
 * @param action - Permission action that must be allowed.
 * @param subject - Permission subject type or subject resolver factory to check.
 * @param options - Optional authorization-domain settings.
 * @returns Nest custom metadata decorator.
 */
export function Can<T extends Subject = Subject>(
  action: string,
  subject: CanSubject<T>,
  options?: CanOptions,
): CustomDecorator<typeof USER_CAN_METADATA | typeof WORKSPACE_CAN_METADATA>;

/**
 * Routes a permission declaration to its scoped decorator.
 *
 * @param action - Permission action that must be allowed.
 * @param subject - Permission subject type or subject resolver factory to check.
 * @param options - Optional authorization-domain settings.
 * @returns Nest custom metadata decorator.
 */
export function Can<T extends Subject = Subject>(
  action: string,
  subject: CanSubject<T>,
  options: CanOptions = {},
): CustomDecorator<typeof USER_CAN_METADATA | typeof WORKSPACE_CAN_METADATA> {
  return options.scope === "user"
    ? UserCan(action, subject)
    : WorkspaceCan(action, subject);
}
