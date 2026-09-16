import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Session } from "../entities/session.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(Session)
  .addField({
    field: "created_at",
    replacement: "createdAt",
    sortable: true,
    type: "date",
  })
  .build();

/** Session pagination arguments. */
@ArgsType()
export class SessionConnectionArgs extends ConnectionArgs {}

/** A page of visible active sessions. */
@ObjectType()
export class SessionConnection extends Connection {}
