import { Injectable, type OnApplicationShutdown } from "@nestjs/common";

import { PostgresQueue } from "./postgres.js";
import { QueueFactory } from "./queue.factory.js";

/** Injectable PostgreSQL BullMQ queue with module configuration and managed shutdown. */
@Injectable()
export abstract class BaseQueue<
  Data = any,
  Result = any,
  Name extends string = string,
>
  extends PostgresQueue<Data, Result, Name>
  implements OnApplicationShutdown
{
  constructor(factory: QueueFactory) {
    const { name, options } = factory.getQueueOptions(new.target);
    super(name, options);
  }

  /** Closes the queue's PostgreSQL connection during application shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
