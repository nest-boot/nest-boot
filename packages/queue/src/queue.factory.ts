import { type Abstract, Inject, Injectable, Optional } from "@nestjs/common";
import type { QueueOptions as BullQueueOptions } from "bullmq";

import type { BaseQueue } from "./base-queue.js";
import { JOB_SERVICE, MODULE_OPTIONS_TOKEN } from "./queue.constants.js";
import { getQueueDefinition } from "./queue.decorator.js";
import type { QueueModuleOptions } from "./queue-module-options.interface.js";
import type { QueueOptions } from "./queue-options.interface.js";
import type { JobService } from "./services/job.service.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";

/** Creates declared queues from Nest factory providers for dynamic configuration. */
@Injectable()
export class QueueFactory {
  private overrides?: QueueOptions;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: QueueModuleOptions,
    @Optional()
    @Inject(JOB_SERVICE)
    private readonly jobService?: JobService | null,
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
    const factory = new QueueFactory(this.options, this.jobService);
    factory.overrides = options;
    return new queue(factory);
  }

  /**
   * Resolves a queue's configuration before its Redis connection is created.
   * @param queue - Declared queue class.
   * @returns Connection options and the optional persistence observer.
   * @internal
   */
  getQueueOptions(queue: Abstract<BaseQueue>): {
    name: string;
    options: BullQueueOptions;
    service?: JobService;
    ttl?: number;
  } {
    const {
      name,
      persistence: declaredPersistence,
      ...declaredOptions
    } = getQueueDefinition(queue);
    const { persistence: overriddenPersistence, ...runtimeOptions } =
      this.overrides ?? {};
    const persistence = { ...declaredPersistence, ...overriddenPersistence };
    const options = { ...declaredOptions, ...runtimeOptions };
    const root = { ...this.options };
    delete root.persistence;
    delete root.graphql;
    delete root.getJobReadFilter;
    if (persistence.enabled && !this.jobService) {
      throw new Error(
        `Queue "${name}" has persistence.enabled: true but job persistence is unavailable. Register QueueModule and DatabaseModule, and include the built-in Job entity from @nest-boot/queue/persistence in database discovery.`,
      );
    }
    return {
      name,
      options: {
        ...root,
        ...options,
        connection:
          options.connection ?? this.options.connection ?? loadConfigFromEnv(),
      },
      service: persistence.enabled ? (this.jobService ?? undefined) : undefined,
      ttl: persistence.ttl,
    };
  }
}
