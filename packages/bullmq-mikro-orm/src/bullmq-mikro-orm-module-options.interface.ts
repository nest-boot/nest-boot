import { EntityClass, EntityData } from "@mikro-orm/core";
import { Job } from "bullmq";

import { JobEntity } from "./entities/job.entity";

export interface BullMQMikroORMModuleOptions<T extends JobEntity = JobEntity> {
  jobEntity: EntityClass<T>;

  jobTTL?: number;

  convertJobToEntityData?: (job: Job) => EntityData<T> | Promise<EntityData<T>>;

  includeQueues?: string[];
  excludeQueues?: string[];
}
