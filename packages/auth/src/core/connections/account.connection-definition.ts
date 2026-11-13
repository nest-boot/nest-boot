import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Account } from "../entities/account.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(Account)
  .addField({
    field: "created_at",
    replacement: "createdAt",
    sortable: true,
    type: "date",
  })
  .addField({
    field: "provider_id",
    replacement: "providerId",
    filterable: true,
    type: "string",
  })
  .build();

/** Account pagination arguments. */
@ArgsType()
export class AccountConnectionArgs extends ConnectionArgs {}

/** A page of the current session user's linked accounts. */
@ObjectType()
export class AccountConnection extends Connection {}
