import type { Subject } from "@casl/ability";
import type { CustomDecorator } from "@nestjs/common";
import { SetMetadata } from "@nestjs/common";

import type { CanMetadata } from "../interfaces/can-metadata.interface.js";
import type { CanOptions } from "../interfaces/can-options.interface.js";
import { CAN_METADATA } from "../permission.constants.js";
import type { CanSubject } from "../types/can-subject.type.js";

/**
 * Declares that the current route requires the given action on the given subject.
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
): CustomDecorator<typeof CAN_METADATA>;

/**
 * Creates permission metadata for the current route handler.
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
): CustomDecorator<typeof CAN_METADATA> {
  if (!subject) {
    throw new TypeError("Permission subject is required.");
  }

  const metadata: CanMetadata<T> = {
    action,
    scope: options.scope ?? "workspace",
    subject,
  };

  return SetMetadata(CAN_METADATA, metadata);
}
