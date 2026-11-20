import type { Subject, SubjectType } from "@casl/ability";
import type { CustomDecorator } from "@nestjs/common";

import type { CanSubject } from "../../core/types/can-subject.type.js";
import type { CanSubjectCallback } from "../../core/types/can-subject-callback.type.js";
import { CAN_METADATA } from "../constants/permission.constants.js";
import type { CanMetadata } from "../interfaces/can-metadata.interface.js";
import { appendMetadata } from "../utils/append-metadata.util.js";

const CLASS_CONSTRUCTOR_PATTERN = /^class(?:\s|\{)/;

/**
 * Determines whether a value passed to `Can` is a static subject type rather than a callback.
 * @param value - Candidate subject type or callback.
 * @returns `true` when the value is a non-empty subject name or ES class constructor.
 */
function isSubjectType(value: unknown): value is SubjectType {
  if (typeof value === "string") {
    return value.length > 0;
  }

  if (typeof value !== "function") {
    return false;
  }

  return CLASS_CONSTRUCTOR_PATTERN.test(
    Function.prototype.toString.call(value),
  );
}

/**
 * Requires an action on a static subject type; repeated declarations must all be allowed.
 * @param action - Permission action to check.
 * @param subject - Entity class or subject name to authorize.
 * @returns Decorator that appends authorization metadata to the handler.
 */
export function Can(
  action: string,
  subject: SubjectType,
): CustomDecorator<typeof CAN_METADATA>;

/**
 * Requires an action on the callback result; repeated declarations must all be allowed.
 * @param action - Permission action to check.
 * @param subjectCallback - Callback that resolves the resource being authorized.
 * @returns Decorator that appends authorization metadata to the handler.
 */
export function Can<
  T extends Subject = Subject,
  TSelf = unknown,
  TArgs extends unknown[] = unknown[],
>(
  action: string,
  subjectCallback: CanSubjectCallback<T, TSelf, TArgs>,
): CustomDecorator<typeof CAN_METADATA>;

/**
 * Requires an action on a static subject type or callback result; repeated declarations must all be allowed.
 * @param action - Permission action to check.
 * @param subjectOrCallback - Static subject type or callback resolving the resource being authorized.
 * @returns Decorator that appends authorization metadata to the handler.
 */
export function Can<
  T extends Subject = Subject,
  TSelf = unknown,
  TArgs extends unknown[] = unknown[],
>(
  action: string,
  subjectOrCallback: CanSubject<T, TSelf, TArgs>,
): CustomDecorator<typeof CAN_METADATA> {
  if (isSubjectType(subjectOrCallback)) {
    const metadata: CanMetadata<T> = { action, subject: subjectOrCallback };
    return appendMetadata(CAN_METADATA, metadata);
  }

  if (typeof subjectOrCallback !== "function") {
    throw new TypeError("Permission subject type or callback is required.");
  }

  const metadata: CanMetadata<T> = {
    action,
    subjectCallback: subjectOrCallback as CanSubjectCallback<T>,
  };
  return appendMetadata(CAN_METADATA, metadata);
}
