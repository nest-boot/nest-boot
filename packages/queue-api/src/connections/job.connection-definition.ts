import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Job as JobEntity } from "../entities/job.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(JobEntity)
  .addField({ field: "id", type: "string", sortable: false })
  .addField({
    field: "queue",
    type: "string",
    filterable: true,
  })
  .addField({
    field: "name",
    type: "string",
    filterable: true,
    searchable: true,
  })
  .addField({
    field: "status",
    type: "string",
    filterable: true,
  })
  .addField({
    field: "created_at",
    replacement: "createdAt",
    type: "date",
    filterable: true,
    sortable: true,
  })
  .build();

/** Cursor pagination, filters and creation-time ordering for visible jobs. */
@ArgsType()
export class JobConnectionArgs extends ConnectionArgs {}

/** Cross-queue Job records within the current authorized scope. */
@ObjectType()
export class JobConnection extends Connection {}
