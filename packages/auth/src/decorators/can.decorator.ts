import type { Subject } from "@casl/ability";
import type { CustomDecorator } from "@nestjs/common";

import type { CanMetadata } from "../interfaces/can-metadata.interface.js";
import { CAN_METADATA } from "../permission.constants.js";
import type { CanSubject } from "../types/can-subject.type.js";
import { appendMetadata } from "../utils/append-metadata.util.js";

/** Requires an action on a subject; repeated declarations must all be allowed. */
export function Can<T extends Subject = Subject>(
  action: string,
  subject: CanSubject<T>,
): CustomDecorator<typeof CAN_METADATA> {
  if (!subject) throw new TypeError("Permission subject is required.");
  const metadata: CanMetadata<T> = { action, subject };
  return appendMetadata(CAN_METADATA, metadata);
}
