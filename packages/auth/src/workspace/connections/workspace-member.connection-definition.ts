import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { WorkspaceMember } from "../entities/workspace-member.entity.js";

const { Connection, ConnectionArgs, Edge } = new ConnectionBuilder(
  WorkspaceMember,
)
  .addField({
    field: "name",
    searchable: true,
    filterable: true,
    prefix: true,
    type: "string",
  })
  .addField({
    field: "email",
    searchable: true,
    filterable: true,
    prefix: true,
    type: "string",
  })
  .addField({ field: "type", filterable: true, type: "string" })
  .addField({
    field: "status",
    filterable: true,
    type: "string",
  })
  .addField({
    field: "created_at",
    replacement: "createdAt",
    filterable: true,
    sortable: true,
    type: "date",
  })
  .build();

// Optional connection nodes enter the schema through enabled resolvers only.
ObjectType("WorkspaceMemberEdge", {
  isAbstract: true,
  description:
    "An auto-generated type which holds one WorkspaceMember and a cursor during pagination.",
})(Edge);

/** Workspace member pagination arguments. */
@ArgsType()
export class WorkspaceMemberConnectionArgs extends ConnectionArgs {}

/** A page of visible workspace members. */
@ObjectType({ isAbstract: true })
export class WorkspaceMemberConnection extends Connection {}
