import { ArgsType, Field } from "@nestjs/graphql";

import { ConnectionArgs } from "./connection.args";

@ArgsType()
export class QueryConnectionArgs extends ConnectionArgs {
  @Field({ nullable: true })
  query?: string;

  @Field({ nullable: true })
  filter?: string;
}
