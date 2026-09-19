import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(WorkspaceApiKey)
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

/**
 * API key pagination arguments.
 */
@ArgsType()
export class WorkspaceApiKeyConnectionArgs extends ConnectionArgs {}

/**
 * A page of visible API keys.
 */
@ObjectType()
export class WorkspaceApiKeyConnection extends Connection {}
