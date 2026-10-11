import type {
  PostgresConnectionOptions,
  QueueOptions as BullQueueOptions,
} from "bullmq";

/** PostgreSQL queue configuration shared by producers and consumers. */
export interface QueueOptions extends Omit<
  BullQueueOptions<PostgresConnectionOptions>,
  "connection" | "prefix"
> {
  connection?: PostgresConnectionOptions;
}

/** Options recorded by the queue class decorator. */
export interface QueueDefinition extends QueueOptions {
  name: string;
  /** Include this queue's jobs in API reads, subject to authorization. Defaults to false. */
  expose?: boolean;
}
