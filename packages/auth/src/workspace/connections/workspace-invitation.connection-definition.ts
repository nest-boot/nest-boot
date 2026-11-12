import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";

const { Connection, ConnectionArgs, Edge } = new ConnectionBuilder(
  WorkspaceInvitation,
)
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
ObjectType("WorkspaceInvitationEdge", {
  isAbstract: true,
  description:
    "An auto-generated type which holds one WorkspaceInvitation and a cursor during pagination.",
})(Edge);

/** Workspace invitation pagination arguments. */
@ArgsType()
export class WorkspaceInvitationConnectionArgs extends ConnectionArgs {}

/** A page of visible workspace invitations. */
@ObjectType({ isAbstract: true })
export class WorkspaceInvitationConnection extends Connection {}
