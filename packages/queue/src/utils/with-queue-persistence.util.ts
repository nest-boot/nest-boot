import { getQueueToken } from "@nestjs/bullmq";
import type {
  DynamicModule,
  FactoryProvider,
  InjectionToken,
} from "@nestjs/common";
import type { Queue } from "bullmq";

import { JOB_HISTORY_SERVICE } from "../queue.constants.js";
import type { RegisterQueueOptions } from "../register-queue-options.interface.js";
import type { JobHistoryService } from "../services/job-history.service.js";

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
    if (
      typeof provider !== "object" ||
      !("provide" in provider) ||
      !("useFactory" in provider) ||
      !tokens.has(provider.provide)
    )
      return provider;
    const factory: FactoryProvider<Queue> = provider;
    const name = tokens.get(factory.provide) ?? "default";
    return {
      ...factory,
      inject: [
        ...(factory.inject ?? []),
        { token: JOB_HISTORY_SERVICE, optional: true },
      ],
      useFactory: async (...args: unknown[]) => {
        const history = args.pop() as JobHistoryService | null | undefined;
        const { persist, ...options } = args[0] as RegisterQueueOptions;
        if (persist && !history) {
          throw new Error(
            `Queue "${name}" has persist: true but job history is unavailable. Register QueueModule and DatabaseModule, and include the built-in Job entity from @nest-boot/queue/persistence in database discovery.`,
          );
        }
        const queue = await factory.useFactory(options, ...args.slice(1));
        if (persist && history) history.registerQueue(queue);
        return queue;
      },
    };
  });
  return definition;
}
