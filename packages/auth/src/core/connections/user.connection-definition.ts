import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { User } from "../entities/user.entity.js";

const { Connection, ConnectionArgs, CountArgs } = new ConnectionBuilder(User)
  .addField({
    field: "name",
    fulltext: "searchableName",
    prefix: true,
    searchable: true,
    filterable: true,
    type: "string",
  })
  .addField({
    field: "email",
    prefix: true,
    searchable: true,
    filterable: true,
    type: "string",
  })
  .addField({
    field: "created_at",
    replacement: "createdAt",
    sortable: true,
    type: "date",
  })
  .build();

/** User pagination arguments. */
@ArgsType()
export class UserConnectionArgs extends ConnectionArgs {}

/** User count filters. */
@ArgsType()
export class UserCountArgs extends CountArgs {}

/** A page of visible users. */
@ObjectType()
export class UserConnection extends Connection {}
