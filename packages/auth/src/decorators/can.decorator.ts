import type { Subject } from "@casl/ability";
import type { CustomDecorator } from "@nestjs/common";

import { CAN_METADATA } from "../permission.constants.js";
import type { CanSubjectCallback } from "../types/can-subject-callback.type.js";
import { appendMetadata } from "../utils/append-metadata.util.js";

/** Requires an action on the callback result; repeated declarations must all be allowed. */
export function Can<
  T extends Subject = Subject,
  TSelf = unknown,
  TArgs extends unknown[] = unknown[],
>(
  action: string,
  subjectCallback: CanSubjectCallback<T, TSelf, TArgs>,
): CustomDecorator<typeof CAN_METADATA> {
  if (typeof subjectCallback !== "function")
    throw new TypeError("Permission subject callback is required.");
  const metadata = { action, subjectCallback };
  return appendMetadata(CAN_METADATA, metadata);
}
