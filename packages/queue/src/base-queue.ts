import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Queue as BullQueue, type Worker } from "bullmq";

import { OBSERVE_WORKER } from "./queue.constants.js";
import { QueueFactory } from "./queue.factory.js";
import type { JobService } from "./services/job.service.js";

/** Injectable BullMQ queue with module configuration and managed shutdown. */
@Injectable()
export abstract class BaseQueue<
  Data = any,
  Result = any,
  Name extends string = string,
>
  extends BullQueue<Data, Result, Name>
  implements OnApplicationShutdown
{
  private readonly persistenceService?: JobService;

  constructor(factory: QueueFactory) {
    const { name, options, service, ttl } = factory.getQueueOptions(new.target);
    super(name, options);
    this.persistenceService = service;
    service?.registerQueue(this, ttl);
  }

  /**
   * @param worker - Local consumer of this queue.
   * @internal
   */
  [OBSERVE_WORKER](worker: Worker): void {
    this.persistenceService?.registerWorker(worker);
  }

  /** Closes the queue's Redis connection during application shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
