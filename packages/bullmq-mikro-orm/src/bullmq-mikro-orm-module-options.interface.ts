import { EntityClass, EntityData } from "@mikro-orm/core";
import { Job } from "bullmq";

import { JobEntity } from "./entities/job.entity";

/** Configuration options for the BullMQ-MikroORM integration module. */
export interface BullMQMikroORMModuleOptions<T extends JobEntity = JobEntity> {
  /** The MikroORM entity class used to persist BullMQ jobs. */
  jobEntity: EntityClass<T>;

  /** Time-to-live (in milliseconds) after which completed/failed jobs are deleted. */
  jobTTL?: number;

  /** Custom function to convert a BullMQ job into entity data for persistence. */
  convertJobToEntityData?: (job: Job) => EntityData<T> | Promise<EntityData<T>>;

  /** Queue names to include for persistence. If unset, all queues are included. */
  includeQueues?: string[];
  /** Queue names to exclude from persistence. */
  excludeQueues?: string[];
}
