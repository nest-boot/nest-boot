import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import type {
  ConnectionArgsInterface,
  ConnectionResult,
} from "@nest-boot/graphql-connection";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { Job } from "../entities/job.entity.js";
import { MODULE_OPTIONS_TOKEN } from "../queue.constants.js";
import type { QueueModuleOptions } from "../queue-module-options.interface.js";

/** Reads BullMQ-owned jobs within the application's authorized scope. BullMQ performs every write. */
@Injectable()
export class JobService {
  private readonly schema: string;

  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: QueueModuleOptions,
  ) {
    const connection = options.connection;
    this.schema =
      connection && typeof connection === "object" && "schema" in connection
        ? (connection.schema ?? "bullmq")
        : "bullmq";
  }

  private async getReadFilter(): Promise<FilterQuery<Job>> {
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

  /**
   * Queries native PostgreSQL jobs, applying the same authorized scope to rows and counts.
   * @param args - Pagination, filtering and sorting arguments.
   * @param info - GraphQL selection information.
   * @returns A connection containing only authorized jobs.
   */
  async getJobConnection(
    args: ConnectionArgsInterface<Job>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<Job>> {
    const where = await this.getReadFilter();
    const { ConnectionManager } = await import("@nest-boot/graphql-connection");
    const { JobConnection } =
      await import("../connections/job.connection-definition.js");
    return await new ConnectionManager(this.em as SqlEntityManager).find(
      JobConnection,
      args,
      {
        where,
        schema: this.schema,
        refresh: true,
        ...(info && { info }),
      },
    );
  }
}
