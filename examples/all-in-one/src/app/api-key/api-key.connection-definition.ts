import { ArgsType, ObjectType } from '@nest-boot/graphql';
import { ConnectionBuilder } from '@nest-boot/graphql-connection';

import { ApiKey } from './api-key.entity.js';

const { Connection, ConnectionArgs } = new ConnectionBuilder(ApiKey)
  .addField({
    field: 'name',
    searchable: true,
    filterable: true,
    type: 'string',
  })
  .addField({
    field: 'key_prefix',
    replacement: 'keyPrefix',
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
 * API Key 分页查询参数。
 */
@ArgsType()
export class ApiKeyConnectionArgs extends ConnectionArgs {}

/**
 * API Key 分页查询结果。
 */
@ObjectType()
export class ApiKeyConnection extends Connection {}
