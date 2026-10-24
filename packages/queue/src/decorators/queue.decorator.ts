import { type Abstract, type Type } from "@nestjs/common";
import { kebabCase } from "lodash-es";

import type { JobName } from "../interfaces/job.interface.js";
import type { JobNameContract } from "../interfaces/job-name.interface.js";
import { QUEUE_NAME } from "../queue.constants.js";
import type { BaseQueue } from "../queues/base.queue.js";

/**
 * Declares the static name of a singleton queue provider.
 * @param name - Static Redis name; defaults to the class name without its Queue suffix, in kebab-case.
 * @returns Queue class decorator.
 */
export function Queue(name?: string) {
  return <C extends Type<BaseQueue>>(
    target: C & JobNameContract<JobName<InstanceType<C>>>,
  ): void => {
    Reflect.defineMetadata(
      QUEUE_NAME,
      name?.trim()
        ? name.trim()
        : kebabCase(target.name.replace(/Queue$/, "") || target.name),
      target,
    );
  };
}

/**
 * Reads a queue name without opening a Redis connection.
 * @param target - Declared queue class.
 * @returns Static queue name.
 * @internal
 */
export function getQueueName(target: Abstract<BaseQueue>): string {
  const name = Reflect.getOwnMetadata(QUEUE_NAME, target) as string | undefined;
  if (!name) {
    throw new Error(`Queue class "${target.name}" requires @Queue().`);
  }
  return name;
}
