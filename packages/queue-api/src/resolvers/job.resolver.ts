import { AuthGuard } from "@nest-boot/auth";
import {
  Args,
  Float,
  ID,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import {
  type ConnectionArgsInterface,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
import { UseGuards } from "@nestjs/common";

import {
  JobConnection,
  JobConnectionArgs,
} from "../connections/job.connection-definition.js";
import { Job as JobEntity } from "../entities/job.entity.js";
import { JobService } from "../services/job.service.js";

/** Authenticated Job queries with visibility and ownership enforced by JobService. */
@UseGuards(AuthGuard)
@Resolver(() => JobEntity)
export class JobResolver {
  constructor(private readonly jobService: JobService) {}

  /**
   * Returns numeric progress without exposing arbitrary BullMQ progress payloads.
   * @param job - Authorized parent job.
   * @returns Finite numeric progress, or null for other progress values.
   */
  @ResolveField(() => Float, { nullable: true })
  progress(@Parent() job: JobEntity): number | null {
    return typeof job.progress === "number" && Number.isFinite(job.progress)
      ? job.progress
      : null;
  }

  /**
   * Reads a task belonging to the current user.
   * @param id - Database-generated Job UUID.
   * @returns Matching record in the authorized scope, or null.
   */
  @Query(() => JobEntity, { nullable: true })
  async userJob(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<JobEntity | null> {
    return await this.jobService.getUserJob(id);
  }

  /**
   * Paginates tasks belonging to the current user.
   * @param args - Cursor pagination, filters and creation-time ordering.
   * @returns A page of jobs in the authorized scope.
   */
  @Query(() => JobConnection)
  async userJobs(
    @Args({ type: () => JobConnectionArgs })
    args: ConnectionArgsInterface<JobEntity>,
  ): Promise<ConnectionResult<JobEntity>> {
    return await this.jobService.getUserJobConnection(args);
  }

  /**
   * Reads a task in the authorized current workspace.
   * @param id - Database-generated Job UUID.
   * @returns Matching record in the authorized scope, or null.
   */
  @Query(() => JobEntity, { nullable: true })
  async workspaceJob(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<JobEntity | null> {
    return await this.jobService.getWorkspaceJob(id);
  }

  /**
   * Paginates tasks in the authorized current workspace.
   * @param args - Cursor pagination, filters and creation-time ordering.
   * @returns A page of jobs in the authorized scope.
   */
  @Query(() => JobConnection)
  async workspaceJobs(
    @Args({ type: () => JobConnectionArgs })
    args: ConnectionArgsInterface<JobEntity>,
  ): Promise<ConnectionResult<JobEntity>> {
    return await this.jobService.getWorkspaceJobConnection(args);
  }

  /**
   * Reads an unowned task after administrator authorization.
   * @param id - Database-generated Job UUID.
   * @returns Matching record in the authorized scope, or null.
   */
  @Query(() => JobEntity, { nullable: true })
  async systemJob(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<JobEntity | null> {
    return await this.jobService.getSystemJob(id);
  }

  /**
   * Paginates unowned tasks after administrator authorization.
   * @param args - Cursor pagination, filters and creation-time ordering.
   * @returns A page of jobs in the authorized scope.
   */
  @Query(() => JobConnection)
  async systemJobs(
    @Args({ type: () => JobConnectionArgs })
    args: ConnectionArgsInterface<JobEntity>,
  ): Promise<ConnectionResult<JobEntity>> {
    return await this.jobService.getSystemJobConnection(args);
  }
}
