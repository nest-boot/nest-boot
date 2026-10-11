import type { OnApplicationShutdown } from "@nestjs/common";

import { PostgresQueue } from "./postgres.js";
import { getQueueDefinition } from "./queue.decorator.js";
import type { QueueModuleOptions } from "./queue-module-options.interface.js";
import type { QueueOptions } from "./queue-options.interface.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";

/** Injectable PostgreSQL BullMQ queue with module configuration and managed shutdown. */
export abstract class BaseQueue<
  Data = any,
  Result = any,
  Name extends string = string,
>
  extends PostgresQueue<Data, Result, Name>
  implements OnApplicationShutdown
{
  /**
   * Creates a queue using module defaults, its declaration and local overrides.
   * @param moduleOptions - Global options injected by `@Queue` for inherited constructors.
   * @param options - Overrides supplied by a custom constructor or factory provider.
   */
  constructor(moduleOptions: QueueModuleOptions, options: QueueOptions = {}) {
    const { name, ...declaredOptions } = getQueueDefinition(new.target);
    const root = { ...moduleOptions };
    delete root.graphql;
    delete root.getJobReadFilter;
    const local = { ...declaredOptions, ...options };
    super(name, {
      ...root,
      ...local,
      connection: local.connection ?? root.connection ?? loadConfigFromEnv(),
    });
  }

  /** Closes the queue's PostgreSQL connection during application shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
