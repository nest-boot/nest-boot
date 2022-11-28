import { ArgsType, Field, Int } from "@nestjs/graphql";

import { Ordering } from "./ordering.input";

@ArgsType()
export class ConnectionArgs {
  @Field(() => String, { nullable: true })
  before?: string;

  @Field(() => String, { nullable: true })
  after?: string;

  @Field(() => Int, { nullable: true })
  first?: number;

  @Field(() => Int, { nullable: true })
  last?: number;

  @Field(() => Ordering, { nullable: true })
  orderBy?: Ordering;
}
