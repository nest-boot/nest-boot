import type { SqlEntityManager } from "@mikro-orm/sql";
import type {
  ConnectionArgsInterface,
  ConnectionResult,
} from "@nest-boot/graphql-connection";
import { Injectable } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import type { Job } from "../entities/job.entity.js";
import { JobService } from "./job.service.js";

/** Adds GraphQL pagination without making it a dependency of native job reads. */
@Injectable()
export class JobConnectionService extends JobService {
  /**
   * Queries native PostgreSQL jobs, applying the authorized scope to rows and counts.
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
