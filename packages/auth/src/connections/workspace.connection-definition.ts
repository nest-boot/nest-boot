import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Workspace } from "../entities/workspace.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(Workspace)
  .addField({
    field: "name",
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

/**
 * Workspace pagination arguments.
 */
@ArgsType()
export class WorkspaceConnectionArgs extends ConnectionArgs {}

/**
 * A page of visible workspaces.
 */
@ObjectType()
export class WorkspaceConnection extends Connection {}
