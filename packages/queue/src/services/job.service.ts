import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";

import { Job } from "../entities/job.entity.js";
import { MODULE_OPTIONS_TOKEN } from "../queue.module-definition.js";
import { QueueRegistrar } from "../queue.registrar.js";
import type { QueueModuleOptions } from "../queue-module-options.interface.js";

/** Reads exposed BullMQ jobs using the EntityManager session and database RLS. BullMQ performs every write. */
@Injectable()
export class JobService {
  protected readonly schema: string;

  constructor(
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    options: QueueModuleOptions,
    @Inject(QueueRegistrar)
    private readonly queues: Pick<QueueRegistrar, "getExposedQueueNames">,
  ) {
    const connection = options.connection;
    this.schema =
      connection && typeof connection === "object" && "schema" in connection
        ? (connection.schema ?? "bullmq")
        : "bullmq";
  }

  /**
   * Restricts API reads to exposed queues; database RLS enforces ownership.
   * @returns Filter shared by node, list and count queries.
   */
  protected getReadFilter(): FilterQuery<Job> {
    return { queue: { $in: this.queues.getExposedQueueNames() } };
  }

  /**
   * Reads one authorized job, returning null when missing or outside the scope.
   * @param id - Queue name and BullMQ job ID, separated by a colon.
   * @returns The visible job, or null.
   */
  async getJob(id: string): Promise<Job | null> {
    const scope = this.getReadFilter();
    const separator = id.indexOf(":");
    if (separator <= 0 || separator === id.length - 1) return null;
    return await this.em.findOne(
      Job,
      {
        $and: [
          scope,
          { queue: id.slice(0, separator), jobId: id.slice(separator + 1) },
        ],
      },
      { schema: this.schema, refresh: true },
    );
  }
}
