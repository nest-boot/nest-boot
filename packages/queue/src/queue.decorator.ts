import { type Abstract, Injectable } from "@nestjs/common";
import { PARAMTYPES_METADATA } from "@nestjs/common/constants";
import { kebabCase } from "lodash-es";

import type { BaseQueue } from "./base-queue.js";
import { MODULE_OPTIONS_TOKEN, QUEUE_OPTIONS } from "./queue.constants.js";
import type { QueueDefinition } from "./queue-options.interface.js";

/**
 * Declares a queue; add the decorated class to its module's providers.
 * @param options - Shared configuration; the queue name defaults to the kebab-cased class name.
 * @returns The queue class decorator.
 */
export function Queue(options: Partial<QueueDefinition> = {}): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(
      QUEUE_OPTIONS,
      { ...options, name: options.name ?? kebabCase(target.name) },
      target,
    );
    Injectable()(target);
    // Only supply BaseQueue's inherited constructor dependency. Custom
    // constructors (including inherited ones) declare their own injections.
    if (!Reflect.hasMetadata(PARAMTYPES_METADATA, target)) {
      Reflect.defineMetadata(
        PARAMTYPES_METADATA,
        [MODULE_OPTIONS_TOKEN],
        target,
      );
    }
  };
}

/**
 * Reads a queue declaration without opening a database connection.
 * @param target - Declared queue class.
 * @returns The queue configuration.
 */
export function getQueueDefinition(
  target: Abstract<BaseQueue>,
): QueueDefinition {
  const definition = Reflect.getMetadata(QUEUE_OPTIONS, target) as
    | QueueDefinition
    | undefined;
  if (!definition?.name)
    throw new Error(
      `Queue class "${target.name}" requires @Queue() with a non-empty name.`,
    );
  return definition;
}
