import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { SystemAccount } from "../entities/system-account.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(SystemAccount)
  .addField({
    field: "name",
    searchable: true,
    filterable: true,
    type: "string",
  })
  .addField({ field: "enabled", filterable: true, type: "boolean" })
  .addField({
    field: "created_at",
    replacement: "createdAt",
    sortable: true,
    type: "date",
  })
  .build();
/** Pagination arguments for SystemAccount. */
@ArgsType()
export class SystemAccountConnectionArgs extends ConnectionArgs {}
/** A page of authorized SystemAccount records. */
@ObjectType()
export class SystemAccountConnection extends Connection {}
