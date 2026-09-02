import { ArgsType, ObjectType } from '@nest-boot/graphql';
import { ConnectionBuilder } from '@nest-boot/graphql-connection';

import { WorkspaceMemberGroup } from './workspace-member-group.entity.js';

const { Connection, ConnectionArgs } = new ConnectionBuilder(
  WorkspaceMemberGroup,
)
  .addField({
    field: 'name',
    replacement: 'searchableName',
    searchable: true,
    filterable: true,
    fulltext: true,
    type: 'string',
  })
  .addField({
    field: 'description',
    replacement: 'searchableDescription',
    searchable: true,
    filterable: true,
    fulltext: true,
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

/** 工作区成员组分页查询参数。 */
@ArgsType()
export class WorkspaceMemberGroupConnectionArgs extends ConnectionArgs {}

/** 工作区成员组分页查询结果。 */
@ObjectType()
export class WorkspaceMemberGroupConnection extends Connection {}
