import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Invitation } from "../../entities/invitation.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(Invitation)
  .addField({
    field: "email",
    filterable: true,
    searchable: true,
    type: "string",
  })
  .addField({ field: "status", filterable: true, type: "string" })
  .addField({
    field: "created_at",
    replacement: "createdAt",
    filterable: true,
    sortable: true,
    type: "date",
  })
  .build();

/** Workspace invitation pagination arguments. */
@ArgsType()
export class InvitationConnectionArgs extends ConnectionArgs {}

/** A page of visible workspace invitations. */
@ObjectType()
export class InvitationConnection extends Connection {}
