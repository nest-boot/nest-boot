import type { QueueOptions as BullQueueOptions } from "bullmq";

import type { JobPersistenceOptions } from "./job-persistence-options.interface.js";

/** Queue configuration shared by producers and consumers. */
export interface QueueOptions extends Omit<BullQueueOptions, "connection"> {
  connection?: BullQueueOptions["connection"];
  /** Enable database persistence and optionally override the root retention. */
  persistence?: JobPersistenceOptions;
}

/** Options recorded by the queue class decorator. */
export interface QueueDefinition extends QueueOptions {
  name: string;
}
