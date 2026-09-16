import { ArgsType, ObjectType } from "@nest-boot/graphql";
import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Member } from "../entities/member.entity.js";

const { Connection, ConnectionArgs } = new ConnectionBuilder(Member)
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

/** 工作区成员分页查询参数。 */
@ArgsType()
export class MemberConnectionArgs extends ConnectionArgs {}

/** 工作区成员分页查询结果。 */
@ObjectType()
export class MemberConnection extends Connection {}
