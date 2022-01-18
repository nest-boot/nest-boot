import { SetMetadata } from "@nestjs/common";
import {
  QueueBaseOptions as BullQueueBaseOptions,
  QueueOptions as BullQueueOptions,
  QueueSchedulerOptions as BullQueueSchedulerOptions,
  WorkerOptions as BullWorkerOptions,
} from "bullmq";
import { kebabCase } from "lodash";

import { QUEUE_METADATA_KEY } from "./constants";

export interface QueueOptions
  extends Omit<
    BullQueueOptions & BullQueueSchedulerOptions & BullWorkerOptions,
    keyof BullQueueBaseOptions
  > {
  name?: string;
}

export function Queue(options?: QueueOptions): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any) => {
    return SetMetadata(QUEUE_METADATA_KEY, {
      name: kebabCase(target.name),
      ...(options || {}),
    })(target);
  };
}
