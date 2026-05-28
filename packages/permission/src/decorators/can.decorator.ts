import type { Subject } from "@casl/ability";
import type { CustomDecorator, Type } from "@nestjs/common";
import { SetMetadata } from "@nestjs/common";

import type { PermissionAction } from "../enums/permission-action.enum";

/** Reflection metadata key used by the `Can` decorator. */
export const CAN_METADATA = Symbol("CAN_METADATA");

/** Factory that resolves a permission subject from the current handler instance and decorated method parameters. */
export type CanSubjectFactory<
  T extends Subject = Subject,
  TSelf = unknown,
  TArgs extends unknown[] = unknown[],
> = (self: TSelf, ...args: TArgs) => T | Promise<T>;

/** Injectable hook that resolves a permission subject from decorated method parameters. */
export interface CanSubjectHook<
  T extends Subject = Subject,
  TArgs extends unknown[] = unknown[],
> {
  /** Resolves the subject used by the permission check. */
  run(...args: TArgs): T | Promise<T>;
}

/** Tuple hook that injects one service before resolving the permission subject. */
export type CanSubjectHookTuple<
  T extends Subject = Subject,
  TService = unknown,
  TArgs extends unknown[] = unknown[],
> = [Type<TService>, (service: TService, ...args: TArgs) => T | Promise<T>];

/** Subject hook class or tuple hook. */
export type CanSubjectHookResolver<T extends Subject = Subject> =
  | Type<CanSubjectHook<T>>
  | CanSubjectHookTuple<T>;

/** Permission subject type or subject resolver factory. */
export type CanSubject<T extends Subject = Subject> =
  | Type<T>
  | CanSubjectFactory<T>;

/** Full `Can` decorator options. */
export interface CanOptions<T extends Subject = Subject> {
  /** Permission action that must be allowed. */
  action: PermissionAction;
  /** Permission subject type or subject resolver factory to check. */
  subject: CanSubject<T>;
  /** Optional hook used to load the concrete subject instance. */
  subjectHook?: CanSubjectHookResolver<T>;
}

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
  subjectHook?: CanSubjectHookResolver<T>,
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
 * @param subjectHook - Optional subject hook used with a subject type.
 * @returns Nest custom metadata decorator.
 */
export function Can<T extends Subject = Subject>(
  actionOrOptions: PermissionAction | CanOptions<T>,
  subject?: CanSubject<T>,
  subjectHook?: CanSubjectHookResolver<T>,
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

  if (subjectHook) {
    options.subjectHook = subjectHook;
  }

  return SetMetadata(CAN_METADATA, options);
}
