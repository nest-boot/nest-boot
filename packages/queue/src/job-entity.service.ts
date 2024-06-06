import { EntityClass, EntityManager } from "@mikro-orm/core";
import { Optional } from "@nestjs/common";

import { Job as JobEntity } from "./entities/job.entity";
import { JobStatus } from "./enums";
import { Job } from "./interfaces";

export class JobEntityService {
  private readonly jobEntity: EntityClass<JobEntity>;

  constructor(
    @Optional()
    private readonly em?: EntityManager,
  ) {
    this.jobEntity = JobEntity;
  }

  async upsert(job: Job, status: JobStatus): Promise<void> {
    if (typeof this.em !== "undefined" && job.id !== "undefined") {
      const jobEntityData = {
        id: job.id,
        name: job.name,
        queueName: job.queueName,
        data: job.data,
        result: job.returnvalue ?? null,
        failedReason: job.failedReason,
        progress: typeof job.progress === "number" ? job.progress : 0,
        status,
        startedAt: job.processedOn ? new Date(job.processedOn) : null,
        settledAt: job.finishedOn ? new Date(job.finishedOn) : null,
        createdAt: new Date(job.timestamp),
        updatedAt: new Date(),
      };

      await this.em.fork().upsert(this.jobEntity, jobEntityData);
    }
  }
}
