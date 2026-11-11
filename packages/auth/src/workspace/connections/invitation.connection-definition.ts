import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Invitation } from "../entities/invitation.entity.js";

const { Connection, ConnectionArgs, Edge } = new ConnectionBuilder(Invitation)
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

// Keep optional connection nodes out of the base-only schema.
ObjectType("InvitationEdge", {
  isAbstract: true,
  description:
    "An auto-generated type which holds one Invitation and a cursor during pagination.",
})(Edge);

/** Workspace invitation pagination arguments. */
@ArgsType()
export class InvitationConnectionArgs extends ConnectionArgs {}

/** A page of visible workspace invitations. */
@ObjectType({ isAbstract: true })
export class InvitationConnection extends Connection {}
