import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { ApiKeyEntity } from "../entities/api-key.entity.js";
import { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(
  SystemAccountApiKey,
  { entity: ApiKeyEntity },
)
  .addField({
    field: "name",
    searchable: true,
    filterable: true,
    type: "string",
  })
  .addField({ field: "prefix", filterable: true, type: "string" })
  .addField({
    field: "last_used_at",
    replacement: "lastUsedAt",
    sortable: true,
    type: "date",
  })
  .addField({ field: "enabled", filterable: true, type: "boolean" })
  .addField({
    field: "created_at",
    replacement: "createdAt",
    sortable: true,
    type: "date",
  })
  .build();
/** Pagination arguments for SystemAccountApiKey. */
@ArgsType()
export class SystemAccountApiKeyConnectionArgs extends ConnectionArgs {}
/** A page of authorized SystemAccountApiKey records. */
@ObjectType()
export class SystemAccountApiKeyConnection extends Connection {}
