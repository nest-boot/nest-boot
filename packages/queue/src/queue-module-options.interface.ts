import type { QueueOptions } from "./queue-options.interface.js";

/** Configuration options for the BullMQ module. */
export interface QueueModuleOptions extends QueueOptions {
  /** Enable job queries when DatabaseModule, Job metadata and GraphQL are available. Defaults to true. */
  graphql?: boolean;
}
