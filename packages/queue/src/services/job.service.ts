import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { Job } from "../entities/job.entity.js";
import { MODULE_OPTIONS_TOKEN } from "../queue.constants.js";
import type { QueueModuleOptions } from "../queue-module-options.interface.js";

/** Reads persisted jobs within the application's authorized request scope. */
@Injectable()
export class JobService {
  /**
   * Creates the request-aware job reader.
   * @param em - Entity manager resolving the current request context.
   * @param options - Queue configuration including the read authorization callback.
   */
  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: QueueModuleOptions,
  ) {}

  private async getReadFilter(): Promise<FilterQuery<Job>> {
    const filter = await this.options.getJobReadFilter?.();
    if (filter == null)
      throw new ForbiddenException(
        "Job history access is not configured for this identity",
      );
    return filter;
  }

  /**
   * Reads one authorized job, returning null when missing or outside the scope.
   * @param id - Queue name and BullMQ job ID, separated by a colon.
   * @returns The visible job, or null.
   */
  async getJob(id: string): Promise<Job | null> {
    return await this.em.findOne(Job, {
      $and: [await this.getReadFilter(), { id }],
    });
  }

  /**
   * Queries job history, applying the same authorized scope to rows and counts.
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
        ...(info && { info }),
      },
    );
  }
}
