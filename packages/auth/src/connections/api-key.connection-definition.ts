import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { ApiKeyEntity } from "../entities/api-key.entity.js";
import { ApiKey } from "../objects/api-key.object.js";

const { Connection, ConnectionArgs, Edge } = new ConnectionBuilder(ApiKey, {
  entity: ApiKeyEntity,
})
  .addField({
    field: "name",
    searchable: true,
    filterable: true,
    type: "string",
  })
  .addField({
    field: "prefix",
    filterable: true,
    type: "string",
  })
  .addField({
    field: "enabled",
    filterable: true,
    type: "boolean",
  })
  .addField({
    field: "last_used_at",
    replacement: "lastUsedAt",
    filterable: true,
    sortable: true,
    type: "date",
  })
  .addField({
    field: "created_at",
    replacement: "createdAt",
    filterable: true,
    sortable: true,
    type: "date",
  })
  .build();

// Optional credential APIs introduce their node types only when enabled.
ObjectType("ApiKeyEdge", { isAbstract: true })(Edge);

/**
 * API key pagination arguments.
 */
@ArgsType()
export class ApiKeyConnectionArgs extends ConnectionArgs {}

/**
 * A page of visible API keys.
 */
@ObjectType({ isAbstract: true })
export class ApiKeyConnection extends Connection {}
