import type { Subject } from "@casl/ability";
import type { CustomDecorator } from "@nestjs/common";

import type { UserCanMetadata } from "../interfaces/user-can-metadata.interface.js";
import { USER_CAN_METADATA } from "../permission.constants.js";
import type { CanSubject } from "../types/can-subject.type.js";
import { appendMetadata } from "../utils/append-metadata.util.js";

/**
 * Declares a permission required in the user authorization scope. When this
 * decorator is repeated, every declared permission must be allowed.
 *
 * @param action - Permission action that must be allowed.
 * @param subject - Permission subject type or subject resolver factory to check.
 * @returns Nest custom metadata decorator.
 */
export function UserCan<T extends Subject = Subject>(
  action: string,
  subject: CanSubject<T>,
): CustomDecorator<typeof USER_CAN_METADATA> {
  if (!subject) {
    throw new TypeError("Permission subject is required.");
  }

  const metadata: UserCanMetadata<T> = {
    action,
    subject,
  };

  return appendMetadata(USER_CAN_METADATA, metadata);
}
