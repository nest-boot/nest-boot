import { Job } from "./job.interface";

export interface QueueConsumer {
  consume(job: Job): void | Promise<void>;
}
