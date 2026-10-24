import type { Type } from "@nestjs/common";

import type { ProcessorContract } from "../interfaces/processor-methods.interface.js";
import type { BaseProcessor } from "../processors/base.processor.js";
import { PROCESSOR_QUEUE } from "../queue.constants.js";
import type { BaseQueue } from "../queues/base.queue.js";

/**
 * Binds a singleton processor and checks all of its named job methods.
 * @param queue - Queue provider consumed by this processor.
 * @returns Class decorator enforcing the queue's handler contracts.
 */
export function Processor<Q extends Type<BaseQueue>>(queue: Q) {
  return <P extends Type<BaseProcessor>>(
    target: P & ProcessorContract<InstanceType<P>, InstanceType<Q>>,
  ): void => {
    Reflect.defineMetadata(PROCESSOR_QUEUE, queue, target);
  };
}
