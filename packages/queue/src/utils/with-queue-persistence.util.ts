import { getQueueToken } from "@nestjs/bullmq";
import type {
  DynamicModule,
  FactoryProvider,
  InjectionToken,
} from "@nestjs/common";
import type { Queue } from "bullmq";

import { JOB_SERVICE } from "../queue.constants.js";
import type { RegisterQueueOptions } from "../register-queue-options.interface.js";
import type { JobService } from "../services/job.service.js";

/**
 * Applies persistence to queues after resolving their synchronous or async options.
 * @param definition - BullMQ's queue registration module.
 * @param queues - Queues registered by this module.
 * @returns The registration module with persistence-aware queue factories.
 */
export function withQueuePersistence(
  definition: DynamicModule,
  queues: { name?: string }[],
): DynamicModule {
  const tokens = new Map<InjectionToken, string>(
    queues.map(({ name }) => [getQueueToken(name), name ?? "default"]),
  );
  definition.providers = definition.providers?.map((provider) => {
    if (typeof provider !== "object" || !("useFactory" in provider))
      return provider;
    const name = tokens.get(provider.provide);
    if (name === undefined) return provider;
    const factory: FactoryProvider<Queue> = provider;
    return {
      ...factory,
      inject: [
        { token: JOB_SERVICE, optional: true },
        ...(factory.inject ?? []),
      ],
      useFactory: async (
        jobService: JobService | null | undefined,
        queueOptions: RegisterQueueOptions,
        ...dependencies: unknown[]
      ) => {
        const { persist, ...options } = queueOptions;
        if (persist && !jobService) {
          throw new Error(
            `Queue "${name}" has persist: true but job persistence is unavailable. Register QueueModule and DatabaseModule, and include the built-in Job entity from @nest-boot/queue/persistence in database discovery.`,
          );
        }
        const queue = await factory.useFactory(options, ...dependencies);
        if (persist && jobService) jobService.registerQueue(queue);
        return queue;
      },
    };
  });
  return definition;
}
