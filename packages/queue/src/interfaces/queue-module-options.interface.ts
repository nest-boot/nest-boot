import type { EntityClass } from "@mikro-orm/core";
import { type WorkerOptions } from "bullmq";

import { Job } from "../entities/job.entity";

export interface QueueModuleOptions extends WorkerOptions {
  jobEntity?: EntityClass<Job>;
}
