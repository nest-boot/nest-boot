import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { Job } from "../entities/job.entity.js";
import { MODULE_OPTIONS_TOKEN } from "../queue.module-definition.js";
import type { QueueModuleOptions } from "../queue-module-options.interface.js";

/** Reads BullMQ-owned jobs within the application's authorized scope. BullMQ performs every write. */
@Injectable()
export class JobService {
  protected readonly schema: string;

  constructor(
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: QueueModuleOptions<FilterQuery<Job>>,
  ) {
    const connection = options.connection;
    this.schema =
      connection && typeof connection === "object" && "schema" in connection
        ? (connection.schema ?? "bullmq")
        : "bullmq";
  }

  /**
   * Resolves the authorized scope shared by native and GraphQL reads.
   * @returns Filter limiting reads to the current identity.
   */
  protected async getReadFilter(): Promise<FilterQuery<Job>> {
    const filter = await this.options.getJobReadFilter?.();
    if (filter == null)
      throw new ForbiddenException(
        "Job access is not configured for this identity",
      );
    return filter;
  }

  /**
   * Reads one authorized job, returning null when missing or outside the scope.
   * @param id - Queue name and BullMQ job ID, separated by a colon.
   * @returns The visible job, or null.
   */
  async getJob(id: string): Promise<Job | null> {
    const scope = await this.getReadFilter();
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
