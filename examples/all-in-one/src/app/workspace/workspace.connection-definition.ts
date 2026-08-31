import { ArgsType, ObjectType } from '@nest-boot/graphql';
import { ConnectionBuilder } from '@nest-boot/graphql-connection';

import { Workspace } from './workspace.entity.js';

const { Connection, ConnectionArgs } = new ConnectionBuilder(Workspace)
  .addField({
    field: 'name',
    searchable: true,
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

/**
 * 工作区分页查询参数。
 */
@ArgsType()
export class WorkspaceConnectionArgs extends ConnectionArgs {}

/**
 * 工作区分页查询结果。
 */
@ObjectType()
export class WorkspaceConnection extends Connection {}
