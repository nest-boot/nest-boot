import { EntityManager } from '@mikro-orm/core';
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
} from '@nest-boot/graphql-connection';
import { Injectable } from '@nestjs/common';
import type { GraphQLResolveInfo } from 'graphql';

import { JobConnection } from './connections/job.connection-definition.js';
import { Job } from './entities/job.entity.js';

/** 使用当前请求的数据库身份查询任务历史。 */
@Injectable()
export class JobService {
  /**
   * 注入使用请求上下文的 EntityManager 和分页查询器。
   * @param em - Entity manager used for persistence.
   * @param connectionManager - Manager used to construct paginated GraphQL connections.
   */
  constructor(
    private readonly em: EntityManager,
    private readonly connectionManager: ConnectionManager,
  ) {}

  /**
   * 返回 RLS 允许访问的任务；不存在或不可见时返回 null。
   * @param id - Identifier of the record to access.
   * @returns Requested queue job, or null if it does not exist.
   */
  async getJob(id: string): Promise<Job | null> {
    return await this.em.findOne(Job, { id });
  }

  /**
   * 按 RLS 可见范围查询分页结果及总数。
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated queue jobs matching the query and selection set.
   */
  async getJobConnection(
    args: ConnectionArgsInterface<Job>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<Job>> {
    return await this.connectionManager.find(JobConnection, args, {
      ...(info && { info }),
    });
  }
}
