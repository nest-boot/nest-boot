import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Invitation } from "../entities/invitation.entity.js";

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

/** 工作区邀请分页查询参数。 */
@ArgsType()
export class InvitationConnectionArgs extends ConnectionArgs {}

/** 工作区邀请分页查询结果。 */
@ObjectType()
export class InvitationConnection extends Connection {}
