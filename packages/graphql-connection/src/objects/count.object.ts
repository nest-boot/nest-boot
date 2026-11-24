import { Field, Int, ObjectType } from "@nest-boot/graphql";

import { CountPrecision } from "../enums/count-precision.enum.js";

/** A bounded count of the records matching a query. */
@ObjectType()
export class Count {
  @Field(() => Int, { complexity: 0 })
  count!: number;

  @Field(() => CountPrecision, { complexity: 0 })
  precision!: CountPrecision;
}
