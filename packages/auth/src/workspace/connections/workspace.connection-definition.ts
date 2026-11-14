import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Workspace } from "../entities/workspace.entity.js";

const { Connection, ConnectionArgs, Edge } = new ConnectionBuilder(Workspace)
  .addField({
    field: "name",
    fulltext: "searchableName",
    searchable: true,
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

// Optional connections must not pull workspace types into a base-only schema.
ObjectType("WorkspaceEdge", {
  isAbstract: true,
  description:
    "An auto-generated type which holds one Workspace and a cursor during pagination.",
})(Edge);

/**
 * Workspace pagination arguments.
 */
@ArgsType()
export class WorkspaceConnectionArgs extends ConnectionArgs {}

/**
 * A page of visible workspaces.
 */
@ObjectType({ isAbstract: true })
export class WorkspaceConnection extends Connection {}
