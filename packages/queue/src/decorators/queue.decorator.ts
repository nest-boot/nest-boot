import {
  type Abstract,
  Injectable,
  type InjectableOptions,
  type Type,
} from "@nestjs/common";
import {
  OPTIONAL_DEPS_METADATA,
  PARAMTYPES_METADATA,
  SCOPE_OPTIONS_METADATA,
  SELF_DECLARED_DEPS_METADATA,
} from "@nestjs/common/constants";
import { kebabCase } from "lodash-es";

import type { BaseQueue } from "../base.queue.js";
import { QUEUE_OPTIONS } from "../queue.constants.js";
import { MODULE_OPTIONS_TOKEN } from "../queue.module-definition.js";
import { queueConstructionContext } from "../queue-construction-context.js";
import type { QueueModuleOptions } from "../queue-module-options.interface.js";
import type { QueueDefinition } from "../queue-options.interface.js";

/**
 * Declares a queue; add the decorated class to its module's providers.
 * @param options - Shared configuration; the queue name defaults to the kebab-cased class name.
 * @returns The queue class decorator.
 */
export function Queue(options: Partial<QueueDefinition> = {}): ClassDecorator {
  return (target) => {
    const dependencies: unknown[] = [
      ...(Reflect.getMetadata(PARAMTYPES_METADATA, target) ?? []),
    ];
    // Inherited queue constructors already contain the framework's hidden argument.
    if (dependencies.at(-1) === MODULE_OPTIONS_TOKEN) {
      dependencies.pop();
    }
    const explicit = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      target,
    ) as { index: number; param: unknown }[] | undefined;
    for (const { index, param } of explicit ?? []) {
      dependencies[index] = param;
    }
    const optionsIndex = dependencies.length;
    const Parent = target as unknown as Type;
    class QueueProvider extends Parent {
      constructor(...args: any[]) {
        if (queueConstructionContext.getStore()?.target === new.target) {
          super(...args);
        } else {
          const moduleOptions = args[optionsIndex] as
            | QueueModuleOptions
            | undefined;
          if (!moduleOptions) {
            throw new Error(
              `Queue "${target.name}" must be created by Nest; register its class as a provider or use ModuleRef.create().`,
            );
          }
          return queueConstructionContext.run(
            { target: new.target, options: moduleOptions },
            () =>
              Reflect.construct(
                Parent,
                args.slice(0, optionsIndex),
                new.target,
              ),
          );
        }
      }
    }
    Object.defineProperty(QueueProvider, "name", { value: target.name });
    for (const key of Reflect.getOwnMetadataKeys(target)) {
      Reflect.defineMetadata(
        key,
        Reflect.getOwnMetadata(key, target),
        QueueProvider,
      );
    }
    if (
      !Reflect.hasOwnMetadata(PARAMTYPES_METADATA, target) &&
      !Reflect.hasOwnMetadata(SELF_DECLARED_DEPS_METADATA, target)
    ) {
      Reflect.defineMetadata(
        OPTIONAL_DEPS_METADATA,
        Reflect.getMetadata(OPTIONAL_DEPS_METADATA, target) ?? [],
        QueueProvider,
      );
    }
    Reflect.defineMetadata(
      QUEUE_OPTIONS,
      { ...options, name: options.name ?? kebabCase(target.name) },
      QueueProvider,
    );
    Reflect.defineMetadata(
      PARAMTYPES_METADATA,
      [...dependencies, MODULE_OPTIONS_TOKEN],
      QueueProvider,
    );
    Injectable(
      Reflect.getMetadata(SCOPE_OPTIONS_METADATA, target) as
        | InjectableOptions
        | undefined,
    )(QueueProvider);
    return QueueProvider as unknown as typeof target;
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
  if (!definition?.name) {
    throw new Error(
      `Queue class "${target.name}" requires @Queue() with a non-empty name.`,
    );
  }
  return definition;
}
