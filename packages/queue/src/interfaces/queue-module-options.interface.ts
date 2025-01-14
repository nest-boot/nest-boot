import { EntityClass, EntityManager } from "@mikro-orm/core";
import { type WorkerOptions } from "bullmq";

import { Job as JobEntity } from "../entities/job.entity";

export interface QueueDatabaseOptions {
  entityManager: EntityManager;
  jobEntityClass: EntityClass<JobEntity>;
}

export interface QueueModuleOptions extends WorkerOptions {
  database?: QueueDatabaseOptions;
}
