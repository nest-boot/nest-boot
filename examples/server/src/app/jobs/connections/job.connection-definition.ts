import { ArgsType, ObjectType } from '@nest-boot/graphql';
import { ConnectionBuilder } from '@nest-boot/graphql-connection';

import { Job } from '../entities/job.entity.js';

const { Connection, ConnectionArgs } = new ConnectionBuilder(Job)
  .addField({
    field: 'queue_name',
    replacement: 'queueName',
    type: 'string',
    filterable: true,
    sortable: true,
  })
  .addField({
    field: 'name',
    type: 'string',
    filterable: true,
    sortable: true,
    searchable: true,
  })
  .addField({
    field: 'status',
    type: 'string',
    filterable: true,
    sortable: true,
  })
  .addField({
    field: 'created_at',
    replacement: 'createdAt',
    type: 'date',
    filterable: true,
    sortable: true,
  })
  .addField({
    field: 'updated_at',
    replacement: 'updatedAt',
    type: 'date',
    filterable: true,
    sortable: true,
  })
  .build();

/** 可见任务的游标分页、筛选及排序参数。 */
@ArgsType()
export class JobConnectionArgs extends ConnectionArgs {}

/** 当前身份可访问的跨队列任务分页结果。 */
@ObjectType()
export class JobConnection extends Connection {}
