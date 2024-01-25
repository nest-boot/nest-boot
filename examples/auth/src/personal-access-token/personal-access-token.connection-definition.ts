// page.connection-definition.ts

import { ConnectionBuilder } from "@nest-boot/graphql-connection";
import { ArgsType, ObjectType } from "@nestjs/graphql";

import { PersonalAccessToken } from "./personal-access-token.entity";

const { Connection, ConnectionArgs } = new ConnectionBuilder(
  PersonalAccessToken,
)
  .addField({ field: "createdAt", filterable: true, sortable: true })
  .addField({ field: "lastUsedAt", filterable: true, sortable: true })
  .addField({ field: "expiresAt", filterable: true, sortable: true })
  .build();

@ObjectType()
export class PersonalAccessTokenConnection extends Connection {}

@ArgsType()
export class PersonalAccessTokenConnectionArgs extends ConnectionArgs {}
