import { type Abstract, Inject, Injectable } from "@nestjs/common";
import type {
  PostgresConnectionOptions,
  QueueOptions as BullQueueOptions,
} from "bullmq";

import type { BaseQueue } from "./base-queue.js";
import { MODULE_OPTIONS_TOKEN } from "./queue.constants.js";
import { getQueueDefinition } from "./queue.decorator.js";
import type { QueueModuleOptions } from "./queue-module-options.interface.js";
import type { QueueOptions } from "./queue-options.interface.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";

/** Creates declared queues from Nest factory providers for dynamic configuration. */
@Injectable()
export class QueueFactory {
  private overrides?: QueueOptions;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: QueueModuleOptions,
  ) {}

  /**
   * Creates the instance returned by a queue class's factory provider.
   * @param queue - Class decorated with `@Queue()`, using the inherited constructor.
   * @param options - Runtime overrides for this application.
   * @returns The configured queue instance, managed by Nest lifecycle hooks.
   */
  create<T extends BaseQueue>(
    queue: new (factory: QueueFactory) => T,
    options?: QueueOptions,
  ): T {
    const factory = new QueueFactory(this.options);
    factory.overrides = options;
    return new queue(factory);
  }

  /**
   * Resolves a queue's configuration before its PostgreSQL connection is created.
   * @param queue - Declared queue class.
   * @returns The declared name and resolved PostgreSQL options.
   * @internal
   */
  getQueueOptions(queue: Abstract<BaseQueue>): {
    name: string;
    options: BullQueueOptions<PostgresConnectionOptions>;
  } {
    const { name, ...declaredOptions } = getQueueDefinition(queue);
    const options = { ...declaredOptions, ...this.overrides };
    const root = { ...this.options };
    delete root.graphql;
    delete root.getJobReadFilter;
    return {
      name,
      options: {
        ...root,
        ...options,
        connection:
          options.connection ?? root.connection ?? loadConfigFromEnv(),
      },
    };
  }
}
