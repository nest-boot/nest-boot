import type { OnApplicationShutdown } from "@nestjs/common";

import { PostgresQueue } from "./postgres.js";
import { getQueueDefinition } from "./queue.decorator.js";
import { queueConstructionContext } from "./queue-construction-context.js";
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
   * @param options - Overrides supplied by the queue's constructor.
   */
  constructor(options: QueueOptions = {}) {
    const { name, ...declaredOptions } = getQueueDefinition(new.target);
    delete declaredOptions.expose;
    const context = queueConstructionContext.getStore();
    if (context?.target !== new.target)
      throw new Error(
        `Queue "${new.target.name}" must be created by Nest; register its class as a provider or use ModuleRef.create().`,
      );
    const root = { ...context.options };
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
