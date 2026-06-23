import type { Subject } from "@casl/ability";
import type { CustomDecorator } from "@nestjs/common";
import { SetMetadata } from "@nestjs/common";

import type { PermissionAction } from "../enums/permission-action.enum.js";
import type { CanOptions } from "../interfaces/can-options.interface.js";
import { CAN_METADATA } from "../permission.constants.js";
import type { CanSubject } from "../types/can-subject.type.js";

/**
 * Declares that the current route requires the given action on the given subject.
 *
 * @param action - Permission action that must be allowed.
 * @param subject - Permission subject type or subject resolver factory to check.
 * @returns Nest custom metadata decorator.
 */
export function Can<T extends Subject = Subject>(
  action: PermissionAction,
  subject: CanSubject<T>,
): CustomDecorator<typeof CAN_METADATA>;

/**
 * Declares route permission requirements using the full options object.
 *
 * @param options - Permission decorator options.
 * @returns Nest custom metadata decorator.
 */
export function Can<T extends Subject = Subject>(
  options: CanOptions<T>,
): CustomDecorator<typeof CAN_METADATA>;

/**
 * Creates permission metadata for the current route handler.
 *
 * @param actionOrOptions - Permission action or full options object.
 * @param subject - Permission subject used with the positional overload.
 * @returns Nest custom metadata decorator.
 */
export function Can<T extends Subject = Subject>(
  actionOrOptions: PermissionAction | CanOptions<T>,
  subject?: CanSubject<T>,
): CustomDecorator<typeof CAN_METADATA> {
  if (typeof actionOrOptions === "object") {
    return SetMetadata(CAN_METADATA, actionOrOptions);
  }

  if (!subject) {
    throw new TypeError("Permission subject is required.");
  }

  const options: CanOptions<T> = {
    action: actionOrOptions,
    subject,
  };

  return SetMetadata(CAN_METADATA, options);
}
