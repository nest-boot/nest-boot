import { Args, ID, Info, Query, Resolver } from '@nest-boot/graphql';
import type {
  ConnectionArgsInterface,
  ConnectionResult,
} from '@nest-boot/graphql-connection';
import type { GraphQLResolveInfo } from 'graphql';

import {
  JobConnection,
  JobConnectionArgs,
} from './connections/job.connection-definition.js';
import { Job } from './entities/job.entity.js';
import { JobService } from './job.service.js';

/** 由应用全局 AuthGuard 保护的任务历史查询入口。 */
@Resolver(() => Job)
export class JobResolver {
  /** 创建任务查询解析器。 */
  constructor(private readonly jobService: JobService) {}

  /** 按完整任务 ID 查询当前身份可访问的任务。 */
  @Query(() => Job, { nullable: true })
  async job(@Args('id', { type: () => ID }) id: string): Promise<Job | null> {
    return await this.jobService.getJob(id);
  }

  /** 跨队列分页查询当前身份可访问的任务。 */
  @Query(() => JobConnection)
  async jobs(
    @Args({ type: () => JobConnectionArgs }) args: ConnectionArgsInterface<Job>,
    @Info() info: GraphQLResolveInfo,
  ): Promise<ConnectionResult<Job>> {
    return await this.jobService.getJobConnection(args, info);
  }
}
