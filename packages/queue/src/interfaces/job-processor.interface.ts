import { Job } from "./job.interface";

export interface JobProcessor {
  process(job: Job): Promise<any>;
}
