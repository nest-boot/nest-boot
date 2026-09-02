import { ArgsType, ObjectType } from '@nest-boot/graphql';
import { ConnectionBuilder } from '@nest-boot/graphql-connection';

import { WorkspaceMember } from './workspace-member.entity.js';

const { Connection, ConnectionArgs } = new ConnectionBuilder(WorkspaceMember)
  .addField({
    field: 'name',
    replacement: 'searchableName',
    searchable: true,
    filterable: true,
    fulltext: true,
    type: 'string',
  })
  .addField({
    field: 'role',
    filterable: true,
    type: 'string',
  })
  .addField({
    field: 'type',
    filterable: true,
    type: 'string',
  })
  .addField({
    field: 'email',
    searchable: true,
    filterable: true,
    fulltext: true,
    type: 'string',
  })
  .addField({
    field: 'status',
    filterable: true,
    type: 'string',
  })
  .addField({
    field: 'created_at',
    replacement: 'createdAt',
    filterable: true,
    sortable: true,
    type: 'date',
  })
  .build();

/** 工作区成员分页查询参数。 */
@ArgsType()
export class WorkspaceMemberConnectionArgs extends ConnectionArgs {}

/** 工作区成员分页查询结果。 */
@ObjectType()
export class WorkspaceMemberConnection extends Connection {}
