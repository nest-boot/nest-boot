/* eslint-disable @nest-boot/entity-property-config-from-types -- ORM mappings are inherited from JobEntity; these declarations only add GraphQL fields. */
import type { Opt, PolicyCallback } from '@mikro-orm/core';
import { Entity } from '@mikro-orm/decorators/legacy';
import { JobEntity, JobStatus } from '@nest-boot/bullmq-mikro-orm';
import {
  Field,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nest-boot/graphql';
import type { JobProgress } from 'bullmq';
import { GraphQLJSON } from 'graphql-type-json';

registerEnumType(JobStatus, { name: 'JobStatus' });

const matchesJobIdentity: PolicyCallback<Job> = (columns) =>
  `("${columns.data}" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "${columns.data}" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), ''))`;

/** 跨队列任务记录：data 中的用户或工作区任意匹配即可访问。 */
@ObjectType()
@Entity({
  policies: [
    {
      command: 'all',
      roles: ['authenticated'],
      using: matchesJobIdentity,
      check: matchesJobIdentity,
    },
  ],
})
export class Job extends JobEntity {
  /** 队列名称与 BullMQ 任务 ID 组成的唯一标识。 */
  @Field(() => ID)
  declare id: string;

  /** 所属队列名称。 */
  @Field(() => String)
  declare queueName: string;

  /** 任务名称。 */
  @Field(() => String)
  declare name: string;

  /** 原始任务参数，包括 userId、workspaceId 和业务数据。 */
  @Field(() => GraphQLJSON)
  declare data: unknown;

  /** 完成任务后保存的返回值。 */
  @Field(() => GraphQLJSON, { nullable: true })
  declare returnValue?: unknown;

  /** 任务失败原因。 */
  @Field(() => String, { nullable: true })
  declare failedReason?: string;

  /** 任务优先级。 */
  @Field(() => Int)
  declare priority: number;

  /** BullMQ 保存的进度值，可为数字或结构化 JSON。 */
  // eslint-disable-next-line @nest-boot/graphql-field-config-from-types -- BullMQ progress supports both scalar and structured JSON values.
  @Field(() => GraphQLJSON)
  declare progress: Opt<JobProgress>;

  /** 最近同步到数据库的任务状态。 */
  @Field(() => JobStatus)
  declare status: JobStatus;

  /** 最近一次开始处理的时间。 */
  @Field(() => Date, { nullable: true })
  declare startedAt?: Date;

  /** 最近一次完成或失败的时间。 */
  @Field(() => Date, { nullable: true })
  declare finishedAt?: Date;

  /** 任务创建时间。 */
  @Field(() => Date)
  declare createdAt: Opt<Date>;

  /** 任务记录最后同步时间。 */
  @Field(() => Date)
  declare updatedAt: Opt<Date>;
}
