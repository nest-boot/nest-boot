import { createPostgresBackend, withBackend } from "bullmq";

/** Official BullMQ constructors bound to PostgreSQL without changing global defaults. */
export const {
  Queue: PostgresQueue,
  Worker: PostgresWorker,
  QueueEvents: PostgresQueueEvents,
} = withBackend(createPostgresBackend);
export type PostgresWorker = InstanceType<typeof PostgresWorker>;
export type PostgresQueueEvents = InstanceType<typeof PostgresQueueEvents>;
