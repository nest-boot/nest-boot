import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { MemberApiKey } from "../entities/member-api-key.entity.js";

const { Connection, ConnectionArgs, Edge } = new ConnectionBuilder(MemberApiKey)
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

// Optional connections must not pull workspace types into a base-only schema.
ObjectType("MemberApiKeyEdge", {
  isAbstract: true,
  description:
    "An auto-generated type which holds one MemberApiKey and a cursor during pagination.",
})(Edge);

/**
 * API key pagination arguments.
 */
@ArgsType()
export class MemberApiKeyConnectionArgs extends ConnectionArgs {}

/**
 * A page of visible API keys.
 */
@ObjectType({ isAbstract: true })
export class MemberApiKeyConnection extends Connection {}
