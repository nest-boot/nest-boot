import { EntityClass, EntityData } from "@mikro-orm/core";
import { Job } from "bullmq";

import { JobEntity } from "./entities/job.entity";

/**
 * Options for configuring the BullMQMikroORMModule.
 */
export interface BullMQMikroORMModuleOptions<T extends JobEntity = JobEntity> {
  /**
   * The MikroORM entity class that represents a job.
   */
  jobEntity: EntityClass<T>;

  /**
   * Time-to-live for job records in the database, in milliseconds.
   * Jobs older than this will be automatically cleaned up.
   */
  jobTTL?: number;

  /**
   * Function to convert a BullMQ Job to entity data.
   */
  convertJobToEntityData?: (job: Job) => EntityData<T> | Promise<EntityData<T>>;

  /**
   * List of queue names to include for monitoring.
   */
  includeQueues?: string[];

  /**
   * List of queue names to exclude from monitoring.
   */
  excludeQueues?: string[];
}
