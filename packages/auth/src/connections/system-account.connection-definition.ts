import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { SystemAccount } from "../entities/system-account.entity.js";

const { Connection, ConnectionArgs, Edge } = new ConnectionBuilder(
  SystemAccount,
)
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

// Referenced only by enabled system-account management APIs.
ObjectType("SystemAccountEdge", { isAbstract: true })(Edge);
/** Pagination arguments for SystemAccount. */
@ArgsType()
export class SystemAccountConnectionArgs extends ConnectionArgs {}
/** A page of authorized SystemAccount records. */
@ObjectType({ isAbstract: true })
export class SystemAccountConnection extends Connection {}
